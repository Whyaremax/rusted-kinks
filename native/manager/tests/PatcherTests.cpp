#include "HeadlessOptions.h"
#include "Patcher.h"
#include "SourcePatches.h"

#include <QCryptographicHash>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QTemporaryDir>
#include <QtTest>

#include <algorithm>

namespace {

void writeFile(const QString& path, const QByteArray& bytes)
{
    QDir().mkpath(QFileInfo(path).absolutePath());
    QFile file(path);
    QVERIFY2(file.open(QIODevice::WriteOnly), qPrintable(file.errorString()));
    QCOMPARE(file.write(bytes), bytes.size());
}

QByteArray readFile(const QString& path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        return {};
    }
    return file.readAll();
}

struct Fixture {
    QTemporaryDir root;
    QString appRoot;
    QString bridgeMod;
    QString saveSentinel;

    Fixture()
    {
        QVERIFY(root.isValid());
        appRoot = QDir(root.path()).filePath(QStringLiteral("game/resources/app"));
        bridgeMod = QDir(root.path()).filePath(
            QStringLiteral("game/Mods/KDHybridBridge.zip"));
        saveSentinel =
            QDir(root.path()).filePath(QStringLiteral("userData/profile.sav"));
        writeFile(QDir(appRoot).filePath(QStringLiteral("index.html")),
                  "<!doctype html><script src=\"./out/main.js\"></script>\n");
        writeFile(QDir(appRoot).filePath(QStringLiteral("out/main.js")),
                  "fixture bundle\n");
        writeFile(saveSentinel, "do-not-touch");
    }
};

struct ScopedSourceCatalog {
    explicit ScopedSourceCatalog(const kd::SourcePatchCatalog* catalog)
    {
        kd::setSourcePatchCatalogForTesting(catalog);
    }

    ~ScopedSourceCatalog()
    {
        kd::setSourcePatchCatalogForTesting(nullptr);
    }

    void select(const kd::SourcePatchCatalog* catalog)
    {
        kd::setSourcePatchCatalogForTesting(catalog);
    }
};

kd::SourcePatchDefinition fixtureLegacyDefinition(bool legacy)
{
    const kd::SourcePatchFileInfo main{
        QStringLiteral("out/main.js"),
        QStringLiteral("2926c6be8e612dd34c0d7031440291b43441beeabe276e5a9dfb4995f6f0b209"),
        QStringLiteral("21a92471d0bb7ed77a20a7a277ebd4e05db7b766af0b0607ffaefadea3637c0a"),
    };
    return {
        kd::SourcePatchInfo{
            QStringLiteral("fixture-source-optimizations-v6"),
            QStringLiteral("fixture"), QStringLiteral("package"),
            main.inputSha256, main.outputSha256,
            QStringLiteral("https://example.invalid/fixture-v6"), {main},
            legacy,
        },
        {{main,
          QByteArray("diff --git a/out/main.js b/out/main.js\n"
                     "--- a/out/main.js\n+++ b/out/main.js\n"
                     "@@ -1,1 +1,1 @@\n-main official\n"
                     "+main legacy v6\n")}},
    };
}

kd::SourcePatchDefinition fixtureActiveDefinition()
{
    const kd::SourcePatchFileInfo main{
        QStringLiteral("out/main.js"),
        QStringLiteral("2926c6be8e612dd34c0d7031440291b43441beeabe276e5a9dfb4995f6f0b209"),
        QStringLiteral("d9a20394454401d719374241cbeaef57b96fe2ebf3ba88946c5b1b0a841d33c0"),
    };
    const kd::SourcePatchFileInfo filter{
        QStringLiteral("Scripts/lib/pixi-filters.js"),
        QStringLiteral("6f2c15b1f9479c41e25e884c499e75338d25030c755731683c56313cf93f611a"),
        QStringLiteral("2ddf0184b064bdd7e82d5e9f1d9a975f91e9ac13659715fa4d835eb315df6f1d"),
    };
    return {
        kd::SourcePatchInfo{
            QStringLiteral("fixture-source-optimizations-v7"),
            QStringLiteral("fixture"), QStringLiteral("package"),
            main.inputSha256, main.outputSha256,
            QStringLiteral("https://example.invalid/fixture-v7"),
            {main, filter}, false,
        },
        {
            {main,
             QByteArray("diff --git a/out/main.js b/out/main.js\n"
                        "--- a/out/main.js\n+++ b/out/main.js\n"
                        "@@ -1,1 +1,1 @@\n-main official\n"
                        "+main active v7\n")},
            {filter,
             QByteArray(
                 "diff --git a/Scripts/lib/pixi-filters.js "
                 "b/Scripts/lib/pixi-filters.js\n"
                 "--- a/Scripts/lib/pixi-filters.js\n"
                 "+++ b/Scripts/lib/pixi-filters.js\n"
                 "@@ -1,1 +1,1 @@\n-filter official\n"
                 "+filter active v7\n")},
        },
    };
}

void prepareSourceFixture(Fixture& fixture)
{
    writeFile(QDir(fixture.appRoot).filePath(QStringLiteral("index.html")),
              "<!doctype html>\n"
              "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n"
              "<script src=\"./out/main.js\"></script>\n");
    writeFile(QDir(fixture.appRoot).filePath(QStringLiteral("out/main.js")),
              "main official\n");
    writeFile(QDir(fixture.appRoot).filePath(
                  QStringLiteral("Scripts/lib/pixi-filters.js")),
              "filter official\n");
}

} // namespace

class PatcherTests final : public QObject {
    Q_OBJECT

private slots:
    void headlessSourceModeParsingIsStrict()
    {
        const std::optional<bool> absent =
            kd::parseHeadlessSourceMode({QStringLiteral("manager")});
        QVERIFY(!absent.has_value());

        const std::optional<bool> optimized = kd::parseHeadlessSourceMode(
            {QStringLiteral("manager"), QStringLiteral("--source-mode"),
             QStringLiteral("optimized")});
        QVERIFY(optimized.has_value());
        QVERIFY(*optimized);

        const std::optional<bool> original = kd::parseHeadlessSourceMode(
            {QStringLiteral("manager"), QStringLiteral("--source-mode"),
             QStringLiteral("original")});
        QVERIFY(original.has_value());
        QVERIFY(!*original);

        QVERIFY_EXCEPTION_THROWN(
            kd::parseHeadlessSourceMode(
                {QStringLiteral("manager"), QStringLiteral("--source-mode")}),
            std::invalid_argument);
        QVERIFY_EXCEPTION_THROWN(
            kd::parseHeadlessSourceMode(
                {QStringLiteral("manager"), QStringLiteral("--source-mode"),
                 QStringLiteral("fast")}),
            std::invalid_argument);
        QVERIFY_EXCEPTION_THROWN(
            kd::parseHeadlessSourceMode(
                {QStringLiteral("manager"), QStringLiteral("--source-mode"),
                 QStringLiteral("optimized"),
                 QStringLiteral("--source-mode"),
                 QStringLiteral("original")}),
            std::invalid_argument);
    }

    void recognizesOnlyTheExactSourcePatchHashes()
    {
        const std::optional<kd::KnownBundleMetadata> known55 =
            kd::findKnownBundleMetadata(QStringLiteral(
                "60A85515783853653FD051936429494B8EF85024FF66B08134E68F9FE89248E0"));
        QVERIFY(known55.has_value());
        QCOMPARE(known55->gameVersion, QStringLiteral("5.5.1"));
        QCOMPARE(known55->packageVersion, QStringLiteral("5.1.12"));
        const QList<kd::SourcePatchInfo> catalog = kd::sourcePatchCatalog();
        QCOMPARE(catalog.size(), 5);
        const auto known556 = kd::findKnownBundleMetadata(QStringLiteral(
            "e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25"));
        QVERIFY(known556.has_value());
        QCOMPARE(known556->gameVersion, QStringLiteral("5.5.6"));
        const auto source556 = kd::findKnownSourceBundle(known556->bundleSha256);
        QVERIFY(source556.has_value());
        QVERIFY(!source556->sourcePatched);
        QCOMPARE(source556->patch.id, QStringLiteral("kd-5.5.6-source-optimizations-v2"));
        const auto findPatch = [&catalog](const QString& id) {
            const auto found = std::find_if(
                catalog.cbegin(), catalog.cend(), [&id](const auto& patch) {
                    return patch.id == id;
                });
            return found == catalog.cend() ? nullptr : &*found;
        };
        const kd::SourcePatchInfo* legacy = findPatch(
            QStringLiteral("kd-5.4.92-source-optimizations-v6"));
        const kd::SourcePatchInfo* active54 = findPatch(
            QStringLiteral("kd-5.4.92-source-optimizations-v7"));
        const kd::SourcePatchInfo* active55 = findPatch(
            QStringLiteral("kd-5.5.1-source-optimizations-v1"));
        const auto old556 = findPatch(QStringLiteral("kd-5.5.6-source-optimizations-v1"));
        const auto active556 = findPatch(QStringLiteral("kd-5.5.6-source-optimizations-v2"));
        QVERIFY(old556 != nullptr && old556->legacy);
        QVERIFY(active556 != nullptr && !active556->legacy);
        QVERIFY(legacy != nullptr);
        QVERIFY(active54 != nullptr);
        QVERIFY(active55 != nullptr);
        QVERIFY(legacy->legacy);
        QVERIFY(!active54->legacy);
        QVERIFY(!active55->legacy);
        QCOMPARE(legacy->files.size(), 1);
        QCOMPARE(active54->files.size(), 2);
        QCOMPARE(active55->files.size(), 2);
        QCOMPARE(active54->upstreamVersion, QStringLiteral("5.4.92"));
        QCOMPARE(active54->packageVersion, QStringLiteral("5.1.12"));
        QCOMPARE(active54->inputSha256,
                 QStringLiteral(
                     "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4"));
        QCOMPARE(active54->outputSha256,
                 QStringLiteral(
                     "aa92bb52a07a553086525704f3b1ee8f3a7f2fe6e008cd507f74c9cde9c57b3d"));
        QCOMPARE(active54->sourceUrl,
                 QStringLiteral(
                     "https://github.com/Ada18980/KinkiestDungeon/tree/"
                     "5c96c4c1e67faf136ba2c167ed889a9e29005a18"));
        QCOMPARE(active54->files.at(1).path,
                 QStringLiteral("Scripts/lib/pixi-filters.js"));
        QCOMPARE(active54->files.at(1).outputSha256,
                 QStringLiteral(
                     "4cfc4145e5950a17df19642fcc6cc378b2b3abef4276e7f56e39628739ae6b95"));
        QCOMPARE(active55->inputSha256,
                 QStringLiteral(
                     "60a85515783853653fd051936429494b8ef85024ff66b08134e68f9fe89248e0"));
        QCOMPARE(active55->outputSha256,
                 QStringLiteral(
                     "2a42cf93ea4d084988afdd37d5bd96c0f9fe4f7ef6b662b2ed1f8776a7443234"));
        QCOMPARE(legacy->outputSha256,
                 QStringLiteral(
                     "aa4c09e73de34b1ab6eea5328880049578963c7c3dcbaae07728ca408da59f92"));
        QVERIFY(kd::isKnownSourceBundle(active54->inputSha256.toUpper()));
        QVERIFY(kd::isKnownSourceBundle(active54->outputSha256));
        QVERIFY(kd::isKnownSourceBundle(active55->inputSha256));
        QVERIFY(kd::isKnownSourceBundle(legacy->outputSha256));
        QVERIFY(!kd::isKnownPatchedSourceBundle(active54->inputSha256));
        QVERIFY(kd::isKnownPatchedSourceBundle(
            active54->outputSha256.toUpper()));
        QVERIFY(kd::isKnownPatchedSourceBundle(active55->outputSha256));
        QVERIFY(kd::isKnownPatchedSourceBundle(legacy->outputSha256));
        const std::optional<kd::SourceBundleMatch> original =
            kd::findKnownSourceBundle(active54->inputSha256);
        QVERIFY(original.has_value());
        QVERIFY(!original->sourcePatched);
        QCOMPARE(original->patch.id, active54->id);
        const std::optional<kd::SourceBundleMatch> oldInstalled =
            kd::findKnownSourceBundle(legacy->outputSha256);
        QVERIFY(oldInstalled.has_value());
        QVERIFY(oldInstalled->sourcePatched);
        QCOMPARE(oldInstalled->patch.id, legacy->id);
        QVERIFY(!kd::isKnownSourceBundle(QStringLiteral("not-a-bundle")));

        const kd::SourcePatchResult unknown = kd::applyKnownSourcePatch(
            QByteArray("fixture bundle\n"), QStringLiteral("not-a-bundle"));
        QVERIFY(!unknown.applied);
        QVERIFY(unknown.bytes.isEmpty());
        QVERIFY(unknown.manifest.isEmpty());

        const kd::SourcePatchResult alreadyPatched =
            kd::applyKnownSourcePatch(QByteArray("fixture bundle\n"),
                                      active54->outputSha256);
        QVERIFY(!alreadyPatched.applied);
        QVERIFY(alreadyPatched.bytes.isEmpty());
        QVERIFY(alreadyPatched.manifest.isEmpty());
    }

    void genericCatalogSelectsActiveAndAppliesMultipleFiles()
    {
        const kd::SourcePatchFileInfo legacyMain{
            QStringLiteral("out/main.js"),
            QStringLiteral("2926c6be8e612dd34c0d7031440291b43441beeabe276e5a9dfb4995f6f0b209"),
            QStringLiteral("21a92471d0bb7ed77a20a7a277ebd4e05db7b766af0b0607ffaefadea3637c0a"),
        };
        const kd::SourcePatchDefinition legacy{
            kd::SourcePatchInfo{
                QStringLiteral("fixture-v6"), QStringLiteral("fixture"),
                QStringLiteral("package"), legacyMain.inputSha256,
                legacyMain.outputSha256,
                QStringLiteral("https://example.invalid/v6"),
                {legacyMain}, true,
            },
            {{legacyMain,
              QByteArray("diff --git a/out/main.js b/out/main.js\n"
                         "--- a/out/main.js\n+++ b/out/main.js\n"
                         "@@ -1,1 +1,1 @@\n-main official\n"
                         "+main legacy v6\n")}},
        };
        const kd::SourcePatchFileInfo activeMain{
            QStringLiteral("out/main.js"), legacyMain.inputSha256,
            QStringLiteral("d9a20394454401d719374241cbeaef57b96fe2ebf3ba88946c5b1b0a841d33c0"),
        };
        const kd::SourcePatchFileInfo filter{
            QStringLiteral("Scripts/lib/pixi-filters.js"),
            QStringLiteral("6f2c15b1f9479c41e25e884c499e75338d25030c755731683c56313cf93f611a"),
            QStringLiteral("2ddf0184b064bdd7e82d5e9f1d9a975f91e9ac13659715fa4d835eb315df6f1d"),
        };
        const kd::SourcePatchDefinition active{
            kd::SourcePatchInfo{
                QStringLiteral("fixture-v7"), QStringLiteral("fixture"),
                QStringLiteral("package"), activeMain.inputSha256,
                activeMain.outputSha256,
                QStringLiteral("https://example.invalid/v7"),
                {activeMain, filter}, false,
            },
            {
                {activeMain,
                 QByteArray("diff --git a/out/main.js b/out/main.js\n"
                            "--- a/out/main.js\n+++ b/out/main.js\n"
                            "@@ -1,1 +1,1 @@\n-main official\n"
                            "+main active v7\n")},
                {filter,
                 QByteArray(
                     "diff --git a/Scripts/lib/pixi-filters.js "
                     "b/Scripts/lib/pixi-filters.js\n"
                     "--- a/Scripts/lib/pixi-filters.js\n"
                     "+++ b/Scripts/lib/pixi-filters.js\n"
                     "@@ -1,1 +1,1 @@\n-filter official\n"
                     "+filter active v7\n")},
            },
        };
        const kd::SourcePatchCatalog catalog({legacy, active});
        QCOMPARE(catalog.findActive(legacyMain.inputSha256)->id,
                 QStringLiteral("fixture-v7"));
        QCOMPARE(catalog.findById(QStringLiteral("fixture-v6"))->outputSha256,
                 legacyMain.outputSha256);

        const kd::SourcePatchResult result = catalog.apply({
            {QStringLiteral("out/main.js"), QByteArray("main official\n"),
             activeMain.inputSha256},
            {QStringLiteral("Scripts/lib/pixi-filters.js"),
             QByteArray("filter official\n"), filter.inputSha256},
        });
        QVERIFY(result.applied);
        QCOMPARE(result.patch.id, QStringLiteral("fixture-v7"));
        QCOMPARE(result.files.size(), 2);
        QCOMPARE(result.files[0].bytes, QByteArray("main active v7\n"));
        QCOMPARE(result.files[1].bytes, QByteArray("filter active v7\n"));
        QVERIFY(result.manifest.value(QStringLiteral("files")).isArray());
    }

    void genericCatalogRejectsUnsafeAndConflictingFiles()
    {
        const kd::SourcePatchFileInfo main{
            QStringLiteral("out/main.js"), QString(64, QLatin1Char('a')),
            QString(64, QLatin1Char('b')),
        };
        const kd::SourcePatchFileInfo unsafe{
            QStringLiteral("../pixi.js"), QString(64, QLatin1Char('c')),
            QString(64, QLatin1Char('d')),
        };
        const kd::SourcePatchDefinition definition{
            kd::SourcePatchInfo{
                QStringLiteral("unsafe"), QStringLiteral("fixture"),
                QStringLiteral("package"), main.inputSha256,
                main.outputSha256, QStringLiteral("https://example.invalid"),
                {main, unsafe}, false,
            },
            {
                {main,
                 QByteArray("diff --git a/out/main.js b/out/main.js\n"
                            "--- a/out/main.js\n+++ b/out/main.js\n"
                            "@@ -1,1 +1,1 @@\n-a\n+b\n")},
                {unsafe,
                 QByteArray("diff --git a/../pixi.js b/../pixi.js\n"
                            "--- a/../pixi.js\n+++ b/../pixi.js\n"
                            "@@ -1,1 +1,1 @@\n-c\n+d\n")},
            },
        };
        QVERIFY_EXCEPTION_THROWN(kd::SourcePatchCatalog({definition}),
                                 std::logic_error);
    }

    void modernMobileMetaIsKnownBuildOnlyAndReversibleInputIsUntouched()
    {
        const QByteArray original(
            "<head>\r\n  <meta name=\"apple-mobile-web-app-capable\" "
            "content=\"yes\">\r\n</head>\r\n");
        QCOMPARE(kd::ensureModernMobileMeta(original, false), original);
        QCOMPARE(
            kd::ensureModernMobileMeta(original, true),
            QByteArray(
                "<head>\r\n  <meta name=\"apple-mobile-web-app-capable\" "
                "content=\"yes\">\r\n  <meta name=\"mobile-web-app-capable\" "
                "content=\"yes\">\r\n</head>\r\n"));
        const QByteArray alreadyModern(
            "<meta name=\"mobile-web-app-capable\" content=\"yes\">");
        QCOMPARE(kd::ensureModernMobileMeta(alreadyModern, true),
                 alreadyModern);
        QVERIFY_EXCEPTION_THROWN(
            kd::ensureModernMobileMeta(QByteArray("<head></head>"), true),
            kd::PatcherError);
    }

    void rejectsFictitiousMultiFileManifest()
    {
        Fixture fixture;
        const kd::PatcherStatus installed =
            kd::Patcher::install(fixture.appRoot, true);
        QJsonObject manifest = installed.manifest;
        manifest.insert(
            QStringLiteral("sourcePatch"),
            QJsonObject{
                {QStringLiteral("id"), QStringLiteral("fixture-v7")},
                {QStringLiteral("path"), QStringLiteral("out/main.js")},
                {QStringLiteral("backupPath"),
                 QStringLiteral(".kd-hybrid/backups/fake/out-main.js")},
                {QStringLiteral("originalSha256"),
                 QString(64, QLatin1Char('a'))},
                {QStringLiteral("patchedSha256"),
                 QString(64, QLatin1Char('b'))},
                {QStringLiteral("upstreamVersion"), QStringLiteral("fixture")},
                {QStringLiteral("sourceUrl"),
                 QStringLiteral("https://example.invalid/fixture")},
                {QStringLiteral("files"), QJsonArray{}},
            });
        const QString manifestPath = QDir(fixture.appRoot).filePath(
            QStringLiteral(".kd-hybrid/installation.json"));
        writeFile(manifestPath,
                  QJsonDocument(manifest).toJson(QJsonDocument::Indented));

        QVERIFY_EXCEPTION_THROWN(kd::Patcher::status(fixture.appRoot),
                                 kd::PatcherError);
        QCOMPARE(readFile(fixture.saveSentinel), QByteArray("do-not-touch"));
    }

    void sourceModeDisablesReenablesAndUninstallsEveryOwnedFile()
    {
        const kd::SourcePatchCatalog catalog({fixtureActiveDefinition()});
        ScopedSourceCatalog override(&catalog);
        Fixture fixture;
        prepareSourceFixture(fixture);

        kd::PatcherStatus current = kd::Patcher::install(
            fixture.appRoot, true, QStringLiteral("fast"),
            QStringLiteral("auto"), false);
        QCOMPARE(current.state, kd::PatcherState::Installed);
        QVERIFY(!current.manifest.value(QStringLiteral("sourcePatch"))
                     .toObject()
                     .value(QStringLiteral("enabled"))
                     .toBool());
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("out/main.js"))),
                 QByteArray("main official\n"));
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("Scripts/lib/pixi-filters.js"))),
                 QByteArray("filter official\n"));

        current = kd::Patcher::install(fixture.appRoot, true);
        QVERIFY(!current.manifest.value(QStringLiteral("sourcePatch"))
                     .toObject()
                     .value(QStringLiteral("enabled"))
                     .toBool());
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("out/main.js"))),
                 QByteArray("main official\n"));

        current = kd::Patcher::updateSourceOptimizations(fixture.appRoot, true);
        QCOMPARE(current.state, kd::PatcherState::Installed);
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("out/main.js"))),
                 QByteArray("main active v7\n"));
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("Scripts/lib/pixi-filters.js"))),
                 QByteArray("filter active v7\n"));

        current = kd::Patcher::updateSourceOptimizations(fixture.appRoot, false);
        QCOMPARE(current.state, kd::PatcherState::Installed);
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("out/main.js"))),
                 QByteArray("main official\n"));
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("Scripts/lib/pixi-filters.js"))),
                 QByteArray("filter official\n"));

        current = kd::Patcher::updateSourceOptimizations(fixture.appRoot, true);
        QCOMPARE(current.state, kd::PatcherState::Installed);
        QCOMPARE(kd::Patcher::uninstall(fixture.appRoot).state,
                 kd::PatcherState::NotInstalled);
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("out/main.js"))),
                 QByteArray("main official\n"));
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("Scripts/lib/pixi-filters.js"))),
                 QByteArray("filter official\n"));
    }

    void sourceModeMigratesLegacySingleFileIntoActiveMultiFilePatch()
    {
        const kd::SourcePatchCatalog legacyCatalog(
            {fixtureLegacyDefinition(false)});
        const kd::SourcePatchCatalog activeCatalog(
            {fixtureLegacyDefinition(true), fixtureActiveDefinition()});
        ScopedSourceCatalog override(&legacyCatalog);
        Fixture fixture;
        prepareSourceFixture(fixture);

        kd::PatcherStatus current = kd::Patcher::install(fixture.appRoot, true);
        QCOMPARE(current.manifest.value(QStringLiteral("sourcePatch"))
                     .toObject()
                     .value(QStringLiteral("id"))
                     .toString(),
                 QStringLiteral("fixture-source-optimizations-v6"));
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("out/main.js"))),
                 QByteArray("main legacy v6\n"));
        current =
            kd::Patcher::updateSourceOptimizations(fixture.appRoot, false);
        QCOMPARE(current.state, kd::PatcherState::Installed);
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("out/main.js"))),
                 QByteArray("main official\n"));

        override.select(&activeCatalog);
        current =
            kd::Patcher::updateSourceOptimizations(fixture.appRoot, true);
        QCOMPARE(current.state, kd::PatcherState::Installed);
        const QJsonObject sourcePatch =
            current.manifest.value(QStringLiteral("sourcePatch")).toObject();
        QCOMPARE(sourcePatch.value(QStringLiteral("id")).toString(),
                 QStringLiteral("fixture-source-optimizations-v7"));
        QCOMPARE(sourcePatch.value(QStringLiteral("files")).toArray().size(), 2);
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("out/main.js"))),
                 QByteArray("main active v7\n"));
        QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                     QStringLiteral("Scripts/lib/pixi-filters.js"))),
                 QByteArray("filter active v7\n"));
        QCOMPARE(kd::Patcher::uninstall(fixture.appRoot).state,
                 kd::PatcherState::NotInstalled);
    }

    void acceptsGenuineV012SingleFileSourceManifestShape()
    {
        const kd::SourcePatchCatalog catalog(
            {fixtureLegacyDefinition(false)});
        ScopedSourceCatalog override(&catalog);
        Fixture fixture;
        prepareSourceFixture(fixture);
        kd::PatcherStatus installed =
            kd::Patcher::install(fixture.appRoot, true);
        QJsonObject manifest = installed.manifest;
        QJsonObject sourcePatch =
            manifest.value(QStringLiteral("sourcePatch")).toObject();
        sourcePatch.remove(QStringLiteral("enabled"));
        sourcePatch.remove(QStringLiteral("files"));
        manifest.insert(QStringLiteral("sourcePatch"), sourcePatch);
        QJsonObject settings =
            manifest.value(QStringLiteral("settings")).toObject();
        settings.remove(QStringLiteral("sourceOptimizations"));
        settings.remove(QStringLiteral("textureMode"));
        manifest.insert(QStringLiteral("settings"), settings);
        writeFile(QDir(fixture.appRoot).filePath(
                      QStringLiteral(".kd-hybrid/installation.json")),
                  QJsonDocument(manifest).toJson(QJsonDocument::Indented));

        QCOMPARE(kd::Patcher::status(fixture.appRoot).state,
                 kd::PatcherState::Installed);
        QCOMPARE(kd::Patcher::updateSourceOptimizations(fixture.appRoot, false)
                     .state,
                 kd::PatcherState::Installed);
        QCOMPARE(kd::Patcher::updateSourceOptimizations(fixture.appRoot, true)
                     .state,
                 kd::PatcherState::Installed);
        QCOMPARE(kd::Patcher::uninstall(fixture.appRoot).state,
                 kd::PatcherState::NotInstalled);
    }

    void injectedFreshBackupFailuresLeaveNoInstallation()
    {
        const kd::SourcePatchCatalog catalog({fixtureActiveDefinition()});
        ScopedSourceCatalog override(&catalog);
        const QStringList points{
            QStringLiteral("fresh-before-backups"),
            QStringLiteral("fresh-after-index-backup"),
            QStringLiteral("fresh-after-source-backup"),
        };
        for (const QString& point : points) {
            Fixture fixture;
            prepareSourceFixture(fixture);
            kd::Patcher::setFailurePointForTesting(point);
            QVERIFY_EXCEPTION_THROWN(
                kd::Patcher::install(fixture.appRoot, true),
                kd::PatcherError);
            QCOMPARE(kd::Patcher::status(fixture.appRoot).state,
                     kd::PatcherState::NotInstalled);
            QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                         QStringLiteral("out/main.js"))),
                     QByteArray("main official\n"));
            QCOMPARE(readFile(QDir(fixture.appRoot).filePath(
                         QStringLiteral("Scripts/lib/pixi-filters.js"))),
                     QByteArray("filter official\n"));
            QVERIFY(!QFileInfo::exists(QDir(fixture.appRoot).filePath(
                QStringLiteral(".kd-hybrid/pending-installation.json"))));
        }
    }

    void injectedSourceTransactionsRestoreFilesAndNewMigrationBackups()
    {
        const kd::SourcePatchCatalog activeCatalog({fixtureActiveDefinition()});
        ScopedSourceCatalog override(&activeCatalog);
        Fixture toggleFixture;
        prepareSourceFixture(toggleFixture);
        kd::Patcher::install(toggleFixture.appRoot, true,
                             QStringLiteral("fast"), QStringLiteral("auto"),
                             false);
        kd::Patcher::setFailurePointForTesting(
            QStringLiteral("configuration-before-manifest"));
        QVERIFY_EXCEPTION_THROWN(
            kd::Patcher::updateSourceOptimizations(toggleFixture.appRoot, true),
            kd::PatcherError);
        QCOMPARE(kd::Patcher::status(toggleFixture.appRoot).state,
                 kd::PatcherState::Installed);
        QCOMPARE(readFile(QDir(toggleFixture.appRoot).filePath(
                     QStringLiteral("out/main.js"))),
                 QByteArray("main official\n"));

        const kd::SourcePatchCatalog legacyCatalog(
            {fixtureLegacyDefinition(false)});
        const kd::SourcePatchCatalog migratedCatalog(
            {fixtureLegacyDefinition(true), fixtureActiveDefinition()});
        override.select(&legacyCatalog);
        Fixture migrationFixture;
        prepareSourceFixture(migrationFixture);
        const kd::PatcherStatus legacy =
            kd::Patcher::install(migrationFixture.appRoot, true);
        override.select(&migratedCatalog);
        kd::Patcher::setFailurePointForTesting(
            QStringLiteral("migration-after-source-backup"));
        QVERIFY_EXCEPTION_THROWN(
            kd::Patcher::install(migrationFixture.appRoot, true),
            kd::PatcherError);
        QCOMPARE(kd::Patcher::status(migrationFixture.appRoot).state,
                 kd::PatcherState::Installed);
        QCOMPARE(readFile(QDir(migrationFixture.appRoot).filePath(
                     QStringLiteral("out/main.js"))),
                 QByteArray("main legacy v6\n"));
        const QString auxiliaryBackup = QStringLiteral(
            ".kd-hybrid/backups/%1/source/Scripts/lib/pixi-filters.js")
                                            .arg(legacy.manifest
                                                     .value(QStringLiteral("id"))
                                                     .toString());
        QVERIFY(!QFileInfo::exists(
            QDir(migrationFixture.appRoot).filePath(auxiliaryBackup)));
    }

    void detectsExtraPayloadAndTamperedIndexBackup()
    {
        Fixture fixture;
        const kd::PatcherStatus installed =
            kd::Patcher::install(fixture.appRoot, true);
        const QString extra = QDir(fixture.appRoot).filePath(
            QStringLiteral("kd-hybrid/unrecorded.txt"));
        writeFile(extra, "extra");
        kd::PatcherStatus current = kd::Patcher::status(fixture.appRoot);
        QCOMPARE(current.state, kd::PatcherState::Modified);
        QVERIFY(current.problems.contains(QStringLiteral(
            "kd-hybrid/unrecorded.txt is not recorded in the installation manifest")));
        QVERIFY(QFile::remove(extra));

        const QString backup = QDir(fixture.appRoot).filePath(
            installed.manifest.value(QStringLiteral("index"))
                .toObject()
                .value(QStringLiteral("backupPath"))
                .toString());
        writeFile(backup, "tampered");
        current = kd::Patcher::status(fixture.appRoot);
        QCOMPARE(current.state, kd::PatcherState::Modified);
        QVERIFY(current.problems.contains(QStringLiteral(
            "Original index.html backup hash does not match the manifest")));
    }

    void rejectsForgedSchemaOneDestructiveMetadata()
    {
        Fixture fixture;
        const QJsonObject baseline =
            kd::Patcher::install(fixture.appRoot, true).manifest;
        const QString manifestPath = QDir(fixture.appRoot).filePath(
            QStringLiteral(".kd-hybrid/installation.json"));
        const auto rejected = [&](const QJsonObject& manifest) {
            writeFile(manifestPath,
                      QJsonDocument(manifest).toJson(QJsonDocument::Indented));
            bool didReject = false;
            try {
                (void)kd::Patcher::status(fixture.appRoot);
            } catch (const kd::PatcherError&) {
                didReject = true;
            }
            QVERIFY(didReject);
        };

        QJsonObject forged = baseline;
        forged.insert(QStringLiteral("id"), QStringLiteral("../escape"));
        rejected(forged);

        forged = baseline;
        forged.insert(QStringLiteral("appRoot"), QStringLiteral(".."));
        rejected(forged);

        forged = baseline;
        QJsonObject index = forged.value(QStringLiteral("index")).toObject();
        index.insert(QStringLiteral("backupPath"),
                     QStringLiteral(".kd-hybrid/backups/elsewhere/index.html"));
        forged.insert(QStringLiteral("index"), index);
        rejected(forged);

        forged = baseline;
        QJsonObject upstream =
            forged.value(QStringLiteral("upstream")).toObject();
        upstream.insert(QStringLiteral("bundlePath"),
                        QStringLiteral("Scripts/other.js"));
        forged.insert(QStringLiteral("upstream"), upstream);
        rejected(forged);

        forged = baseline;
        QJsonArray files = forged.value(QStringLiteral("files")).toArray();
        QJsonObject first = files.first().toObject();
        first.insert(QStringLiteral("sha256"),
                     first.value(QStringLiteral("sha256"))
                         .toString()
                         .toUpper());
        files.replace(0, first);
        forged.insert(QStringLiteral("files"), files);
        rejected(forged);

        forged = baseline;
        files = forged.value(QStringLiteral("files")).toArray();
        first = files.first().toObject();
        first.insert(QStringLiteral("bytes"), 1.5);
        files.replace(0, first);
        files.append(files.first());
        forged.insert(QStringLiteral("files"), files);
        rejected(forged);

        writeFile(manifestPath,
                  QJsonDocument(baseline).toJson(QJsonDocument::Indented));
        QCOMPARE(kd::Patcher::status(fixture.appRoot).state,
                 kd::PatcherState::Installed);
    }

    void existingInstallAddsModernMetaAndRestoresOriginalIndex()
    {
        Fixture fixture;
        const QByteArray originalIndex =
            readFile(QDir(fixture.appRoot).filePath(QStringLiteral("index.html")));
        const kd::PatcherStatus installed =
            kd::Patcher::install(fixture.appRoot, true);
        const QString indexPath =
            QDir(fixture.appRoot).filePath(QStringLiteral("index.html"));
        QByteArray legacyIndex = readFile(indexPath);
        legacyIndex.prepend(
            "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n");
        writeFile(indexPath, legacyIndex);

        QJsonObject manifest = installed.manifest;
        QJsonObject upstream =
            manifest.value(QStringLiteral("upstream")).toObject();
        upstream.insert(QStringLiteral("known"), true);
        manifest.insert(QStringLiteral("upstream"), upstream);
        QJsonObject index = manifest.value(QStringLiteral("index")).toObject();
        index.insert(
            QStringLiteral("patchedSha256"),
            QString::fromLatin1(
                QCryptographicHash::hash(legacyIndex,
                                         QCryptographicHash::Sha256).toHex()));
        manifest.insert(QStringLiteral("index"), index);
        writeFile(QDir(fixture.appRoot).filePath(
                      QStringLiteral(".kd-hybrid/installation.json")),
                  QJsonDocument(manifest).toJson(QJsonDocument::Indented));

        const kd::PatcherStatus updated = kd::Patcher::updatePathfindingMode(
            fixture.appRoot, QStringLiteral("human"));
        QCOMPARE(updated.state, kd::PatcherState::Installed);
        const QByteArray updatedIndex = readFile(indexPath);
        QVERIFY(updatedIndex.contains(
            "<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n"
            "<meta name=\"mobile-web-app-capable\" content=\"yes\">"));
        QCOMPARE(kd::Patcher::uninstall(fixture.appRoot).state,
                 kd::PatcherState::NotInstalled);
        QCOMPARE(readFile(indexPath), originalIndex);
    }

    void installsIdempotentlyAndRestoresExactIndex()
    {
        Fixture fixture;
        const QByteArray original =
            QFile(fixture.appRoot + QStringLiteral("/index.html")).exists()
            ? [&] {
                  QFile file(fixture.appRoot + QStringLiteral("/index.html"));
                  file.open(QIODevice::ReadOnly);
                  return file.readAll();
              }()
            : QByteArray();

        kd::PatcherStatus installed;
        try {
            installed = kd::Patcher::install(fixture.appRoot, true);
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        QCOMPARE(installed.state, kd::PatcherState::Installed);
        try {
            QCOMPARE(kd::Patcher::install(fixture.appRoot, true).manifest,
                     installed.manifest);
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        QVERIFY(installed.manifest.value(QStringLiteral("schema")).toInt() == 1);
        QVERIFY(installed.manifest.value(QStringLiteral("files"))
                    .toArray()
                    .size()
                >= 10);
        QCOMPARE(installed.manifest.value(QStringLiteral("modBridge"))
                     .toObject()
                     .value(QStringLiteral("path"))
                     .toString(),
                 QStringLiteral("Mods/KDHybridBridge.zip"));
        QVERIFY(QFileInfo::exists(fixture.bridgeMod));
        QVERIFY(!readFile(fixture.bridgeMod).isEmpty());

        QFile index(fixture.appRoot + QStringLiteral("/index.html"));
        QVERIFY(index.open(QIODevice::ReadOnly));
        QVERIFY(index.readAll().contains("kd-hybrid/kd-hybrid-bootstrap.js"));
        index.close();

        kd::PatcherStatus removed;
        try {
            removed = kd::Patcher::uninstall(fixture.appRoot);
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        QCOMPARE(removed.state, kd::PatcherState::NotInstalled);
        QVERIFY(!QFileInfo::exists(fixture.bridgeMod));
        QFile restored(fixture.appRoot + QStringLiteral("/index.html"));
        QVERIFY(restored.open(QIODevice::ReadOnly));
        QCOMPARE(restored.readAll(), original);
        QFile save(fixture.saveSentinel);
        QVERIFY(save.open(QIODevice::ReadOnly));
        QCOMPARE(save.readAll(), QByteArray("do-not-touch"));
    }

    void refusesUnknownBundleByDefault()
    {
        Fixture fixture;
        QVERIFY_EXCEPTION_THROWN(kd::Patcher::install(fixture.appRoot),
                                 std::runtime_error);
        QCOMPARE(kd::Patcher::status(fixture.appRoot).state,
                 kd::PatcherState::NotInstalled);
    }

    void updatesSettingsAndKeepsOriginalBackup()
    {
        Fixture fixture;
        const QByteArray original =
            readFile(fixture.appRoot + QStringLiteral("/index.html"));
        kd::PatcherStatus installed;
        try {
            installed = kd::Patcher::install(
                fixture.appRoot, true, QStringLiteral("quality"),
                QStringLiteral("full"));
            installed = kd::Patcher::updateConfiguration(
                fixture.appRoot, QStringLiteral("human"),
                QStringLiteral("mobile"));
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        QCOMPARE(installed.state, kd::PatcherState::Installed);
        QCOMPARE(installed.manifest.value(QStringLiteral("settings"))
                     .toObject()
                     .value(QStringLiteral("pathfindingMode"))
                     .toString(),
                 QStringLiteral("human"));
        QCOMPARE(installed.manifest.value(QStringLiteral("settings"))
                     .toObject()
                     .value(QStringLiteral("textureMode"))
                     .toString(),
                 QStringLiteral("mobile"));
        QFile index(fixture.appRoot + QStringLiteral("/index.html"));
        QVERIFY(index.open(QIODevice::ReadOnly));
        QVERIFY(index.readAll().contains("\"pathfindingMode\":\"human\""));
        index.seek(0);
        QVERIFY(index.readAll().contains(
            "\"rendering\":{\"textureMode\":\"mobile\"}"));
        index.close();
        try {
            kd::Patcher::uninstall(fixture.appRoot);
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        QCOMPARE(readFile(fixture.appRoot + QStringLiteral("/index.html")),
                 original);
        QCOMPARE(readFile(fixture.saveSentinel), QByteArray("do-not-touch"));
    }

    void automaticTextureModeRemovesOverride()
    {
        Fixture fixture;
        try {
            kd::Patcher::install(fixture.appRoot, true,
                                 QStringLiteral("fast"),
                                 QStringLiteral("full"));
            const kd::PatcherStatus updated =
                kd::Patcher::updateTextureMode(
                    fixture.appRoot, QStringLiteral("auto"));
            QCOMPARE(updated.state, kd::PatcherState::Installed);
            QCOMPARE(updated.manifest.value(QStringLiteral("settings"))
                         .toObject()
                         .value(QStringLiteral("textureMode"))
                         .toString(),
                     QStringLiteral("auto"));
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        QVERIFY(!readFile(fixture.appRoot + QStringLiteral("/index.html"))
                     .contains("\"textureMode\""));
    }

    void pendingJournalIsIncompleteEvenWithManifest()
    {
        Fixture fixture;
        try {
            kd::Patcher::install(fixture.appRoot, true);
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        writeFile(QDir(fixture.appRoot)
                      .filePath(QStringLiteral(
                          ".kd-hybrid/pending-installation.json")),
                  "{}");
        const kd::PatcherStatus current = kd::Patcher::status(fixture.appRoot);
        QCOMPARE(current.state, kd::PatcherState::Incomplete);
        QVERIFY(current.problems.contains(
            QStringLiteral("pending installation manifest exists")));
    }

    void rejectsUnknownTextureMode()
    {
        Fixture fixture;
        QVERIFY_EXCEPTION_THROWN(
            kd::Patcher::install(fixture.appRoot, true,
                                 QStringLiteral("fast"),
                                 QStringLiteral("impossible")),
            kd::PatcherError);
        QCOMPARE(kd::Patcher::status(fixture.appRoot).state,
                 kd::PatcherState::NotInstalled);
    }

    void refusesToRemoveModifiedPayload()
    {
        Fixture fixture;
        try {
            kd::Patcher::install(fixture.appRoot, true);
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        writeFile(QDir(fixture.appRoot)
                      .filePath(QStringLiteral(
                          "kd-hybrid/kd-hybrid-bootstrap.js")),
                  "user modification");
        QCOMPARE(kd::Patcher::status(fixture.appRoot).state,
                 kd::PatcherState::Modified);
        QVERIFY_EXCEPTION_THROWN(kd::Patcher::uninstall(fixture.appRoot),
                                 std::runtime_error);
    }

    void upgradesVerifiedPreBridgeInstallationInPlace()
    {
        Fixture fixture;
        kd::PatcherStatus installed;
        try {
            installed = kd::Patcher::install(fixture.appRoot, true);
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        const QString manifestPath = QDir(fixture.appRoot).filePath(
            QStringLiteral(".kd-hybrid/installation.json"));
        QJsonObject legacy =
            QJsonDocument::fromJson(readFile(manifestPath)).object();
        legacy.remove(QStringLiteral("modBridge"));
        QJsonArray legacyFiles;
        for (const QJsonValue& value :
             legacy.value(QStringLiteral("files")).toArray()) {
            if (value.toObject().value(QStringLiteral("path")).toString()
                != QStringLiteral("kd-hybrid/KDHybridBridge.zip")) {
                legacyFiles.append(value);
            }
        }
        legacy.insert(QStringLiteral("files"), legacyFiles);
        writeFile(manifestPath,
                  QJsonDocument(legacy).toJson(QJsonDocument::Indented));
        QVERIFY(QFile::remove(QDir(fixture.appRoot).filePath(
            QStringLiteral("kd-hybrid/KDHybridBridge.zip"))));
        QVERIFY(QFile::remove(fixture.bridgeMod));

        const kd::PatcherStatus outdated =
            kd::Patcher::status(fixture.appRoot);
        QCOMPARE(outdated.state, kd::PatcherState::Installed);
        QVERIFY(outdated.upgradeAvailable);

        kd::PatcherStatus upgraded;
        try {
            upgraded = kd::Patcher::install(fixture.appRoot, true);
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        QCOMPARE(upgraded.state, kd::PatcherState::Installed);
        QVERIFY(!upgraded.upgradeAvailable);
        QVERIFY(QFileInfo::exists(fixture.bridgeMod));
        QCOMPARE(upgraded.manifest.value(QStringLiteral("index"))
                     .toObject()
                     .value(QStringLiteral("backupPath")),
                 installed.manifest.value(QStringLiteral("index"))
                     .toObject()
                     .value(QStringLiteral("backupPath")));
    }

    void refusesToOverwriteUserBridgeMod()
    {
        Fixture fixture;
        writeFile(fixture.bridgeMod, "user mod");
        QVERIFY_EXCEPTION_THROWN(
            kd::Patcher::install(fixture.appRoot, true),
            std::runtime_error);
        QCOMPARE(readFile(fixture.bridgeMod), QByteArray("user mod"));
    }

    void refusesToRemoveModifiedBridgeMod()
    {
        Fixture fixture;
        try {
            kd::Patcher::install(fixture.appRoot, true);
        } catch (const std::exception& error) {
            QFAIL(error.what());
        }
        writeFile(fixture.bridgeMod, "modified");
        const kd::PatcherStatus current =
            kd::Patcher::status(fixture.appRoot);
        QCOMPARE(current.state, kd::PatcherState::Modified);
        QVERIFY(current.problems.contains(
            QStringLiteral("Mods/KDHybridBridge.zip was modified")));
        QVERIFY_EXCEPTION_THROWN(kd::Patcher::uninstall(fixture.appRoot),
                                 std::runtime_error);
        QCOMPARE(readFile(fixture.bridgeMod), QByteArray("modified"));
    }
};

QTEST_GUILESS_MAIN(PatcherTests)

#include "PatcherTests.moc"
