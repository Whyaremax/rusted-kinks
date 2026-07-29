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
    QString saveSentinel;

    Fixture()
    {
        QVERIFY(root.isValid());
        appRoot = QDir(root.path()).filePath(QStringLiteral("game/resources/app"));
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
};

QTEST_GUILESS_MAIN(PatcherTests)

#include "PatcherTests.moc"
