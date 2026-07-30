#include "Patcher.h"
#include "SourcePatches.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QTemporaryDir>
#include <QtTest>

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

} // namespace

class PatcherTests final : public QObject {
    Q_OBJECT

private slots:
    void recognizesOnlyTheExactSourcePatchHashes()
    {
        QVERIFY(kd::isKnownSourceBundle(kd::sourcePatchInputSha256()));
        QVERIFY(kd::isKnownSourceBundle(kd::sourcePatchOutputSha256()));
        QVERIFY(!kd::isKnownSourceBundle(QStringLiteral("not-a-bundle")));
        const kd::SourcePatchResult unknown = kd::applyKnownSourcePatch(
            QByteArray("fixture bundle\n"), QStringLiteral("not-a-bundle"));
        QVERIFY(!unknown.applied);
        QVERIFY(unknown.bytes.isEmpty());
        QVERIFY(unknown.manifest.isEmpty());
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
