#include "Patcher.h"
#include "SourcePatches.h"

#include <QCryptographicHash>
#include <QDateTime>
#include <QDir>
#include <QDirIterator>
#include <QFile>
#include <QFileDevice>
#include <QFileInfo>
#include <QHash>
#include <QJsonArray>
#include <QJsonDocument>
#include <QRegularExpression>
#include <QSaveFile>
#include <QSet>
#include <QUuid>

#include <algorithm>
#include <cmath>
#include <exception>
namespace {

constexpr auto kStateDirectory = ".kd-hybrid";
constexpr auto kManifestPath = ".kd-hybrid/installation.json";
constexpr auto kPendingPath = ".kd-hybrid/pending-installation.json";
constexpr auto kDestinationDirectory = "kd-hybrid";
constexpr auto kBootstrapScript = "kd-hybrid/kd-hybrid-bootstrap.js";
constexpr auto kBridgeModFileName = "KDHybridBridge.zip";
constexpr auto kBridgeModRelativePath = "Mods/KDHybridBridge.zip";

QString resolveNoSymlinkPath(const QString& appRoot,
                             const QString& relativePath,
                             bool requireFile);

struct KnownBundle {
    const char* gameVersion;
    const char* packageVersion;
    const char* sha256;
};

constexpr KnownBundle kKnownBundles[] = {
    {"5.5.6", "5.1.12", "e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25"},
    {
        "5.4.92",
        "5.1.12",
        "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4",
    },
    {
        "5.5.1",
        "5.1.12",
        "60a85515783853653fd051936429494b8ef85024ff66b08134e68f9fe89248e0",
    },
};

[[noreturn]] void fail(const QString& message)
{
    throw kd::PatcherError(kd::PatcherErrorCode::General, message);
}

[[noreturn]] void failPermission(const QString& message)
{
    throw kd::PatcherError(kd::PatcherErrorCode::PermissionDenied, message);
}

void failFile(const QString& action, const QFileDevice& file)
{
    const QString message =
        QStringLiteral("%1: %2").arg(action, file.errorString());
    if (file.error() == QFileDevice::PermissionsError) {
        failPermission(message);
    }
    fail(message);
}

QString validatePathfindingMode(const QString& mode)
{
    if (mode != QLatin1String("quality") && mode != QLatin1String("fast")
        && mode != QLatin1String("human")) {
        fail(QStringLiteral("Unknown pathfinding mode: %1").arg(mode));
    }
    return mode;
}

QString validateTextureMode(const QString& mode)
{
    if (mode != QLatin1String("auto") && mode != QLatin1String("original")
        && mode != QLatin1String("full")
        && mode != QLatin1String("mobile")) {
        fail(QStringLiteral("Unknown texture mode: %1").arg(mode));
    }
    return mode;
}

QString inlineJson(const QJsonObject& object)
{
    QString value =
        QString::fromUtf8(QJsonDocument(object).toJson(QJsonDocument::Compact));
    value.replace(QStringLiteral("<"), QStringLiteral("\\u003c"));
    value.replace(QStringLiteral(">"), QStringLiteral("\\u003e"));
    value.replace(QStringLiteral("&"), QStringLiteral("\\u0026"));
    value.replace(QChar(0x2028), QStringLiteral("\\u2028"));
    value.replace(QChar(0x2029), QStringLiteral("\\u2029"));
    return value;
}

Qt::CaseSensitivity pathCaseSensitivity()
{
#ifdef Q_OS_WIN
    return Qt::CaseInsensitive;
#else
    return Qt::CaseSensitive;
#endif
}

QString canonicalDirectory(const QString& input)
{
    const QFileInfo info(input);
    if (!info.exists() || !info.isDir() || info.isSymLink()) {
        fail(QStringLiteral("Directory does not exist or is unsafe: %1").arg(input));
    }
    const QString canonical = info.canonicalFilePath();
    if (canonical.isEmpty()) {
        fail(QStringLiteral("Could not resolve directory: %1").arg(input));
    }
    return QDir::cleanPath(canonical);
}

QString resolveInside(const QString& root, const QString& relativePath)
{
    if (relativePath.isEmpty() || relativePath.contains(QChar::Null)
        || QDir::isAbsolutePath(relativePath)) {
        fail(QStringLiteral("Unsafe relative path: %1").arg(relativePath));
    }
    const QString normalizedRoot = QDir::cleanPath(root);
    const QString target =
        QDir::cleanPath(QDir(normalizedRoot).absoluteFilePath(relativePath));
    // QDir::cleanPath uses forward slashes on Windows, while
    // QDir::separator() returns a backslash. Keep both sides in the same
    // portable form before enforcing confinement.
    const QString prefix = normalizedRoot + QChar(u'/');
    if (!target.startsWith(prefix, pathCaseSensitivity())) {
        fail(QStringLiteral("Path escapes application root: %1").arg(relativePath));
    }
    return target;
}

QString bridgeModsDirectory(const QString& appRoot)
{
    const QFileInfo appInfo(appRoot);
    const QDir resourcesDirectory = appInfo.dir();
    if (appInfo.fileName().compare(QStringLiteral("app"),
                                   Qt::CaseInsensitive)
            != 0
        || resourcesDirectory.dirName().compare(
               QStringLiteral("resources"), Qt::CaseInsensitive)
            != 0) {
        fail(QStringLiteral(
                 "KD Hybrid bridge mod requires a resources/app layout: %1")
                 .arg(appRoot));
    }
    QDir gameDirectory = resourcesDirectory;
    if (!gameDirectory.cdUp()) {
        fail(QStringLiteral("Could not resolve KD game root from %1")
                 .arg(appRoot));
    }
    return QDir::cleanPath(
        gameDirectory.filePath(QStringLiteral("Mods")));
}

QString resolveBridgeModPath(
    const QString& appRoot,
    const QString& relativePath = QString::fromLatin1(kBridgeModRelativePath))
{
    if (relativePath != QLatin1String(kBridgeModRelativePath)) {
        fail(QStringLiteral("Unexpected KD Hybrid bridge mod path: %1")
                 .arg(relativePath));
    }
    const QString modsDirectory = bridgeModsDirectory(appRoot);
    const QString target = QDir::cleanPath(
        QDir(modsDirectory).filePath(QString::fromLatin1(kBridgeModFileName)));
    if (QFileInfo(target).absolutePath().compare(
            modsDirectory, pathCaseSensitivity())
            != 0
        || QFileInfo(target).fileName()
               != QLatin1String(kBridgeModFileName)) {
        fail(QStringLiteral("Unsafe KD Hybrid bridge mod target: %1")
                 .arg(target));
    }
    return target;
}

void validateLayout(const QString& appRoot)
{
    for (const QString& relative :
         {QStringLiteral("index.html"), QStringLiteral("out/main.js")}) {
        const QFileInfo info(resolveNoSymlinkPath(appRoot, relative, true));
        if (!info.exists() || !info.isFile() || info.isSymLink()) {
            fail(QStringLiteral("Target is not a KD resources/app directory: missing %1")
                     .arg(relative));
        }
    }
}

void validateOptionalManagedDirectory(const QString& appRoot,
                                      const QString& relativePath)
{
    const QString target = resolveInside(appRoot, relativePath);
    const QFileInfo info(target);
    if (!info.exists()) {
        return;
    }
    if (!info.isDir() || info.isSymLink()
        || QDir::cleanPath(info.canonicalFilePath())
                   .compare(QDir::cleanPath(target), pathCaseSensitivity())
            != 0) {
        fail(QStringLiteral("Managed directory is unsafe: %1").arg(target));
    }
}

QByteArray readAll(const QString& path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        failFile(QStringLiteral("Could not read %1").arg(path), file);
    }
    return file.readAll();
}

QString sha256(const QByteArray& bytes)
{
    return QString::fromLatin1(
        QCryptographicHash::hash(bytes, QCryptographicHash::Sha256).toHex());
}

QString sha256File(const QString& path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        failFile(QStringLiteral("Could not hash %1").arg(path), file);
    }
    QCryptographicHash hash(QCryptographicHash::Sha256);
    if (!hash.addData(&file)) {
        fail(QStringLiteral("Could not hash %1").arg(path));
    }
    return QString::fromLatin1(hash.result().toHex());
}

void ensureParent(const QString& path)
{
    const QString parent = QFileInfo(path).absolutePath();
    if (!QDir().mkpath(parent)) {
        fail(QStringLiteral("Could not create directory: %1").arg(parent));
    }
}

void atomicWrite(const QString& path, const QByteArray& bytes)
{
    ensureParent(path);
    QSaveFile file(path);
    if (!file.open(QIODevice::WriteOnly)) {
        failFile(QStringLiteral("Could not open %1").arg(path), file);
    }
    if (file.write(bytes) != bytes.size()) {
        file.cancelWriting();
        fail(QStringLiteral("Short write while updating %1").arg(path));
    }
    if (!file.commit()) {
        failFile(QStringLiteral("Could not atomically update %1").arg(path),
                 file);
    }
}

void writeExclusive(const QString& path, const QByteArray& bytes)
{
    ensureParent(path);
    QFile file(path);
    if (!file.open(QIODevice::WriteOnly | QIODevice::NewOnly)) {
        failFile(QStringLiteral("Refusing to overwrite backup %1").arg(path),
                 file);
    }
    if (file.write(bytes) != bytes.size() || !file.flush()) {
        fail(QStringLiteral("Could not write backup %1").arg(path));
    }
}

void verifyWritableDirectory(const QString& path)
{
    const QString probe = QDir(path).filePath(
        QStringLiteral(".kd-hybrid-write-test-%1.tmp")
            .arg(QUuid::createUuid().toString(QUuid::WithoutBraces)));
    QFile file(probe);
    if (!file.open(QIODevice::WriteOnly | QIODevice::NewOnly)) {
        failFile(QStringLiteral("KD folder is not writable: %1").arg(path),
                 file);
    }
    if (file.write("ok", 2) != 2 || !file.flush()) {
        const QString error = file.errorString();
        file.close();
        QFile::remove(probe);
        failPermission(
            QStringLiteral("KD folder write test failed: %1: %2")
                .arg(path, error));
    }
    file.close();
    if (!QFile::remove(probe)) {
        failPermission(
            QStringLiteral("KD folder write test could not remove %1")
                .arg(probe));
    }
}

void verifyWritableFile(const QString& path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadWrite)) {
        failFile(QStringLiteral("KD file is not writable: %1").arg(path),
                 file);
    }
}

void verifyWritableLayout(const QString& appRoot)
{
    verifyWritableDirectory(appRoot);
    verifyWritableDirectory(
        resolveNoSymlinkPath(appRoot, QStringLiteral("out"), false));
    verifyWritableFile(
        resolveNoSymlinkPath(appRoot, QStringLiteral("index.html"), true));
    verifyWritableFile(
        resolveNoSymlinkPath(appRoot, QStringLiteral("out/main.js"), true));
    for (const QString& relative :
         {QString::fromLatin1(kStateDirectory),
          QString::fromLatin1(kDestinationDirectory)}) {
        const QString existing = resolveNoSymlinkPath(appRoot, relative, false);
        if (QFileInfo(existing).isDir()) {
            verifyWritableDirectory(existing);
        }
    }
}

void verifyWritableBridgeLayout(const QString& appRoot)
{
    const QString modsDirectory = bridgeModsDirectory(appRoot);
    const QFileInfo modsInfo(modsDirectory);
    if (modsInfo.exists()) {
        if (!modsInfo.isDir() || modsInfo.isSymLink()
            || QDir::cleanPath(modsInfo.canonicalFilePath())
                   .compare(QDir::cleanPath(modsInfo.absoluteFilePath()),
                            pathCaseSensitivity()) != 0) {
            fail(QStringLiteral("KD Mods directory is unsafe: %1")
                     .arg(modsDirectory));
        }
        verifyWritableDirectory(modsDirectory);
        return;
    }
    verifyWritableDirectory(QFileInfo(modsDirectory).absolutePath());
}

QJsonObject readJsonObject(const QString& path)
{
    QJsonParseError error;
    const QJsonDocument document = QJsonDocument::fromJson(readAll(path), &error);
    if (error.error != QJsonParseError::NoError || !document.isObject()) {
        fail(QStringLiteral("Invalid JSON in %1: %2").arg(path, error.errorString()));
    }
    return document.object();
}

void atomicWriteJson(const QString& path, const QJsonObject& object)
{
    atomicWrite(path, QJsonDocument(object).toJson(QJsonDocument::Indented));
}

QStringList payloadFiles()
{
    QStringList files;
    QDirIterator iterator(QStringLiteral(":/bootstrap"), QDir::Files,
                          QDirIterator::Subdirectories);
    const QString prefix = QStringLiteral(":/bootstrap/");
    while (iterator.hasNext()) {
        const QString resourcePath = iterator.next();
        if (!resourcePath.startsWith(prefix)) {
            fail(QStringLiteral("Unexpected embedded payload path: %1")
                     .arg(resourcePath));
        }
        files.append(resourcePath.mid(prefix.size()));
    }
    files.sort(Qt::CaseSensitive);
    if (!files.contains(QStringLiteral("kd-hybrid-bootstrap.js"))) {
        fail(QStringLiteral("Embedded payload is missing kd-hybrid-bootstrap.js"));
    }
    if (!files.contains(QString::fromLatin1(kBridgeModFileName))) {
        fail(QStringLiteral("Embedded payload is missing %1")
                 .arg(QString::fromLatin1(kBridgeModFileName)));
    }
    return files;
}

QString& testingFailurePoint()
{
    static QString point;
    return point;
}

void injectTestingFailure(const QString& point)
{
    if (testingFailurePoint() == point) {
        testingFailurePoint().clear();
        fail(QStringLiteral("Injected patcher failure at %1").arg(point));
    }
}

bool isSafePatchRelativePath(const QString& path)
{
    if (path.isEmpty() || path.contains(QChar(u'\\')) || path.contains(QChar(u':'))
        || path.startsWith(QChar(u'/')) || path.endsWith(QChar(u'/'))
        || QDir::isAbsolutePath(path)) {
        return false;
    }
    const QStringList parts = path.split(QChar(u'/'));
    return std::none_of(parts.cbegin(), parts.cend(), [](const QString& part) {
        return part.isEmpty() || part == QLatin1String(".")
            || part == QLatin1String("..");
    });
}

QString resolveNoSymlinkPath(const QString& appRoot,
                             const QString& relativePath,
                             bool requireFile)
{
    if (!isSafePatchRelativePath(relativePath)) {
        fail(QStringLiteral("Unsafe source patch path: %1").arg(relativePath));
    }
    const QString target = resolveInside(appRoot, relativePath);
    QString current = appRoot;
    bool missing = false;
    const QStringList parts = relativePath.split(QChar(u'/'));
    for (qsizetype index = 0; index < parts.size(); ++index) {
        current = QDir(current).filePath(parts[index]);
        if (missing) {
            continue;
        }
        const QFileInfo info(current);
        if (!info.exists() && !info.isSymLink()) {
            missing = true;
            continue;
        }
        const bool last = index == parts.size() - 1;
        if (info.isSymLink()
            || QDir::cleanPath(info.canonicalFilePath())
                   .compare(QDir::cleanPath(info.absoluteFilePath()),
                            pathCaseSensitivity()) != 0
            || (!last && !info.isDir())
            || (last && requireFile && !info.isFile())) {
            fail(QStringLiteral("Symbolic link or unsafe patch path: %1")
                     .arg(relativePath));
        }
    }
    if (missing && requireFile) {
        fail(QStringLiteral("Source patch target is missing: %1")
                 .arg(relativePath));
    }
    return target;
}

QString resolveSafeSourceFile(const QString& appRoot,
                              const QString& relativePath)
{
    if (relativePath == QLatin1String(kStateDirectory)
        || relativePath.startsWith(
            QString::fromLatin1(kStateDirectory) + QLatin1Char('/'))) {
        fail(QStringLiteral("Unsafe source patch target: %1")
                 .arg(relativePath));
    }
    return resolveNoSymlinkPath(appRoot, relativePath, true);
}

QString resolveSafeSourceBackup(const QString& appRoot,
                                const QString& relativePath,
                                bool requireFile)
{
    if (!relativePath.startsWith(
            QString::fromLatin1(kStateDirectory) + QStringLiteral("/backups/"))) {
        fail(QStringLiteral("Unsafe source backup path: %1")
                 .arg(relativePath));
    }
    return resolveNoSymlinkPath(appRoot, relativePath, requireFile);
}

QString resolveSafeManagedFile(const QString& appRoot,
                               const QString& relativePath,
                               bool requireFile)
{
    const QString path = resolveNoSymlinkPath(appRoot, relativePath, requireFile);
    const QFileInfo info(path);
    if ((info.exists() || info.isSymLink()) && !info.isFile()) {
        fail(QStringLiteral("Managed target is not a file: %1")
                 .arg(relativePath));
    }
    return path;
}

QString resolveSafeManagedDirectory(const QString& appRoot,
                                    const QString& relativePath,
                                    bool requireDirectory)
{
    const QString path = resolveNoSymlinkPath(appRoot, relativePath, false);
    const QFileInfo info(path);
    if ((info.exists() || info.isSymLink()) && !info.isDir()) {
        fail(QStringLiteral("Managed target is not a directory: %1")
                 .arg(relativePath));
    }
    if (requireDirectory && !info.exists()) {
        fail(QStringLiteral("Managed directory is missing: %1")
                 .arg(relativePath));
    }
    return path;
}

QString resolveSafeBridgeModPath(const QString& appRoot, bool requireFile)
{
    const QString target = resolveBridgeModPath(appRoot);
    const QString gameRoot = QFileInfo(bridgeModsDirectory(appRoot)).absolutePath();
    const QString checked = resolveNoSymlinkPath(
        gameRoot, QString::fromLatin1(kBridgeModRelativePath), requireFile);
    if (QDir::cleanPath(checked).compare(QDir::cleanPath(target),
                                         pathCaseSensitivity()) != 0) {
        fail(QStringLiteral("Unsafe KD Hybrid bridge mod target: %1").arg(target));
    }
    return target;
}

QJsonArray sourceFilesFromManifest(const QJsonObject& sourcePatch)
{
    QJsonArray files;
    if (sourcePatch.contains(QStringLiteral("files"))) {
        const QJsonValue filesValue = sourcePatch.value(QStringLiteral("files"));
        if (!filesValue.isArray() || filesValue.toArray().isEmpty()) {
            fail(QStringLiteral("Source patch manifest explicitly contains no files"));
        }
        files = filesValue.toArray();
    } else {
        files.append(QJsonObject{
            {QStringLiteral("path"),
             sourcePatch.value(QStringLiteral("path"))},
            {QStringLiteral("backupPath"),
             sourcePatch.value(QStringLiteral("backupPath"))},
            {QStringLiteral("originalSha256"),
             sourcePatch.value(QStringLiteral("originalSha256"))},
            {QStringLiteral("patchedSha256"),
             sourcePatch.value(QStringLiteral("patchedSha256"))},
        });
    }
    static const QRegularExpression hashPattern(
        QStringLiteral("^[0-9a-f]{64}$"));
    QSet<QString> paths;
    QJsonObject primary;
    for (const QJsonValue& value : files) {
        if (!value.isObject()) {
            fail(QStringLiteral("Invalid source patch file manifest"));
        }
        const QJsonObject file = value.toObject();
        const QString path = file.value(QStringLiteral("path")).toString();
        const QString normalizedPath = path.toCaseFolded();
        const QString backupPath =
            file.value(QStringLiteral("backupPath")).toString();
        const QString original =
            file.value(QStringLiteral("originalSha256")).toString();
        const QString patched =
            file.value(QStringLiteral("patchedSha256")).toString();
        if (!isSafePatchRelativePath(path)
            || !isSafePatchRelativePath(backupPath)
            || !backupPath.startsWith(
                QString::fromLatin1(kStateDirectory)
                + QStringLiteral("/backups/"))
            || paths.contains(normalizedPath)
            || !hashPattern.match(original).hasMatch()
            || !hashPattern.match(patched).hasMatch() || original == patched) {
            fail(QStringLiteral("Invalid source patch file manifest: %1")
                     .arg(path));
        }
        paths.insert(normalizedPath);
        if (path == QLatin1String("out/main.js")) {
            primary = file;
        }
    }
    if (primary.isEmpty()
        || primary.value(QStringLiteral("backupPath"))
               != sourcePatch.value(QStringLiteral("backupPath"))
        || primary.value(QStringLiteral("originalSha256"))
               != sourcePatch.value(QStringLiteral("originalSha256"))
        || primary.value(QStringLiteral("patchedSha256"))
               != sourcePatch.value(QStringLiteral("patchedSha256"))) {
        fail(QStringLiteral("Source patch primary manifest is inconsistent"));
    }
    return files;
}

QString sourceBackupRelative(const QString& installationId,
                             const QString& sourcePath)
{
    if (!isSafePatchRelativePath(sourcePath)) {
        fail(QStringLiteral("Unsafe source patch path: %1").arg(sourcePath));
    }
    return sourcePath == QLatin1String("out/main.js")
            ? QStringLiteral("%1/backups/%2/out-main.js")
                  .arg(kStateDirectory, installationId)
            : QStringLiteral("%1/backups/%2/source/%3")
                  .arg(kStateDirectory, installationId, sourcePath);
}

QJsonObject validateManifest(const QJsonObject& manifest, const QString& appRoot)
{
    static const QRegularExpression idPattern(
        QStringLiteral("^[0-9A-Za-z][0-9A-Za-z._-]*$"));
    static const QRegularExpression hashPattern(
        QStringLiteral("^[0-9a-f]{64}$"));
    const auto validBytes = [](const QJsonValue& value) {
        if (!value.isDouble()) {
            return false;
        }
        const double bytes = value.toDouble();
        return std::isfinite(bytes) && bytes >= 0.0 && std::floor(bytes) == bytes
            && bytes <= 9007199254740991.0;
    };
    const auto nullableString = [](const QJsonValue& value) {
        return value.isNull() || value.isString();
    };
    const QString id = manifest.value(QStringLiteral("id")).toString();
    if (manifest.value(QStringLiteral("schema")).toInt(-1) != 1
        || !manifest.value(QStringLiteral("schema")).isDouble()
        || !manifest.value(QStringLiteral("id")).isString()
        || id == QLatin1String(".") || id == QLatin1String("..")
        || id.size() > 128
        || !idPattern.match(id).hasMatch()
        || manifest.value(QStringLiteral("appRoot")).toString()
            != QLatin1String(".")
        || !manifest.value(QStringLiteral("toolVersion")).isString()
        || !manifest.value(QStringLiteral("installedAt")).isString()
        || !manifest.value(QStringLiteral("index")).isObject()
        || !manifest.value(QStringLiteral("upstream")).isObject()
        || !manifest.value(QStringLiteral("files")).isArray()) {
        fail(QStringLiteral("Invalid KD Hybrid installation manifest"));
    }

    const QJsonObject upstream =
        manifest.value(QStringLiteral("upstream")).toObject();
    if (!nullableString(upstream.value(QStringLiteral("version")))
        || !nullableString(upstream.value(QStringLiteral("packageVersion")))
        || upstream.value(QStringLiteral("bundlePath")).toString()
            != QLatin1String("out/main.js")
        || !hashPattern.match(
                upstream.value(QStringLiteral("bundleSha256")).toString())
                .hasMatch()
        || !upstream.value(QStringLiteral("known")).isBool()) {
        fail(QStringLiteral("Invalid upstream metadata in installation manifest"));
    }

    const QJsonObject index =
        manifest.value(QStringLiteral("index")).toObject();
    const QString expectedIndexBackup =
        QStringLiteral("%1/backups/%2/index.html").arg(kStateDirectory, id);
    if (index.value(QStringLiteral("path")).toString()
            != QLatin1String("index.html")
        || index.value(QStringLiteral("backupPath")).toString()
            != expectedIndexBackup
        || !hashPattern.match(
                index.value(QStringLiteral("originalSha256")).toString())
                .hasMatch()
        || !hashPattern.match(
                index.value(QStringLiteral("patchedSha256")).toString())
                .hasMatch()) {
        fail(QStringLiteral("Invalid index metadata in installation manifest"));
    }

    const QJsonArray files = manifest.value(QStringLiteral("files")).toArray();
    if (files.isEmpty()) {
        fail(QStringLiteral("Installation manifest has no payload files"));
    }
    QSet<QString> payloadPaths;
    for (const QJsonValue& value : files) {
        const QJsonObject file = value.toObject();
        const QString path = file.value(QStringLiteral("path")).toString();
        const QString normalizedPath = path.toCaseFolded();
        if (!value.isObject() || !file.value(QStringLiteral("path")).isString()
            || !isSafePatchRelativePath(path)
            || !path.startsWith(QString::fromLatin1(kDestinationDirectory)
                                + QLatin1Char('/'))
            || payloadPaths.contains(normalizedPath)
            || !hashPattern.match(
                    file.value(QStringLiteral("sha256")).toString())
                    .hasMatch()
            || !validBytes(file.value(QStringLiteral("bytes")))) {
            fail(QStringLiteral("Invalid file entry in installation manifest"));
        }
        payloadPaths.insert(normalizedPath);
        resolveInside(appRoot, path);
    }
    const QJsonValue sourcePatchValue =
        manifest.value(QStringLiteral("sourcePatch"));
    if (!sourcePatchValue.isUndefined()) {
        if (!sourcePatchValue.isObject()) {
            fail(QStringLiteral("Invalid source patch in installation manifest"));
        }
        const QJsonObject sourcePatch = sourcePatchValue.toObject();
        if (!sourcePatch.value(QStringLiteral("id")).isString()
            || sourcePatch.value(QStringLiteral("path")).toString()
                != QLatin1String("out/main.js")
            || !sourcePatch.value(QStringLiteral("backupPath")).isString()
            || !hashPattern.match(
                    sourcePatch.value(QStringLiteral("originalSha256")).toString())
                    .hasMatch()
            || !hashPattern.match(
                    sourcePatch.value(QStringLiteral("patchedSha256")).toString())
                    .hasMatch()
            || !sourcePatch.value(QStringLiteral("upstreamVersion")).isString()
            || !sourcePatch.value(QStringLiteral("sourceUrl")).isString()
            || (sourcePatch.contains(QStringLiteral("files"))
                && (!sourcePatch.value(QStringLiteral("files")).isArray()
                    || sourcePatch.value(QStringLiteral("files"))
                           .toArray().isEmpty()))
            || (sourcePatch.contains(QStringLiteral("enabled"))
                && !sourcePatch.value(QStringLiteral("enabled")).isBool())) {
            fail(QStringLiteral("Invalid source patch in installation manifest"));
        }
        const std::optional<kd::SourcePatchInfo> catalog =
            kd::findKnownSourcePatchById(
                sourcePatch.value(QStringLiteral("id")).toString());
        if (!catalog.has_value()
            || sourcePatch.value(QStringLiteral("originalSha256")).toString()
                != catalog->inputSha256
            || sourcePatch.value(QStringLiteral("patchedSha256")).toString()
                != catalog->outputSha256
            || sourcePatch.value(QStringLiteral("upstreamVersion")).toString()
                != catalog->upstreamVersion
            || sourcePatch.value(QStringLiteral("sourceUrl")).toString()
                != catalog->sourceUrl) {
            fail(QStringLiteral(
                "Installed source patch does not match its retained catalog entry"));
        }
        const QJsonArray sourceFiles = sourceFilesFromManifest(sourcePatch);
        if (sourceFiles.size() != catalog->files.size()) {
            fail(QStringLiteral(
                "Installed source patch file set is incomplete"));
        }
        for (const kd::SourcePatchFileInfo& expected : catalog->files) {
            QJsonObject installed;
            for (const QJsonValue& value : sourceFiles) {
                const QJsonObject candidate = value.toObject();
                if (candidate.value(QStringLiteral("path")).toString()
                    == expected.path) {
                    installed = candidate;
                    break;
                }
            }
            const QString expectedBackup = sourceBackupRelative(id, expected.path);
            if (installed.isEmpty()
                || installed.value(QStringLiteral("backupPath")).toString()
                    != expectedBackup
                || installed.value(QStringLiteral("originalSha256")).toString()
                    != expected.inputSha256
                || installed.value(QStringLiteral("patchedSha256")).toString()
                    != expected.outputSha256) {
                fail(QStringLiteral(
                         "Installed source patch files do not match their retained catalog entry: %1")
                         .arg(expected.path));
            }
            resolveInside(appRoot, expected.path);
            resolveInside(appRoot, expectedBackup);
        }
        if (sourcePatch.value(QStringLiteral("backupPath")).toString()
                != sourceBackupRelative(id, QStringLiteral("out/main.js"))
            || sourcePatch.value(QStringLiteral("originalSha256")).toString()
                != upstream.value(QStringLiteral("bundleSha256")).toString()) {
            fail(QStringLiteral(
                "Installed source patch primary metadata does not match upstream"));
        }
    }

    const QJsonValue settingsValue = manifest.value(QStringLiteral("settings"));
    if (!settingsValue.isUndefined()) {
        if (!settingsValue.isObject()) {
            fail(QStringLiteral("Invalid settings in installation manifest"));
        }
        const QJsonObject settings = settingsValue.toObject();
        const QJsonValue pathfinding = settings.value(QStringLiteral("pathfindingMode"));
        const QJsonValue texture = settings.value(QStringLiteral("textureMode"));
        const QJsonValue source = settings.value(QStringLiteral("sourceOptimizations"));
        if ((!pathfinding.isUndefined()
             && (!pathfinding.isString()
                 || (pathfinding.toString() != QLatin1String("quality")
                     && pathfinding.toString() != QLatin1String("fast")
                     && pathfinding.toString() != QLatin1String("human"))))
            || (!texture.isUndefined()
                && (!texture.isString()
                    || (texture.toString() != QLatin1String("auto")
                        && texture.toString() != QLatin1String("original")
                        && texture.toString() != QLatin1String("full")
                        && texture.toString() != QLatin1String("mobile"))))
            || (!source.isUndefined() && !source.isBool())) {
            fail(QStringLiteral("Invalid settings in installation manifest"));
        }
        const bool sourceEnabled = sourcePatchValue.isObject()
            && (!sourcePatchValue.toObject().contains(QStringLiteral("enabled"))
                || sourcePatchValue.toObject()
                       .value(QStringLiteral("enabled")).toBool());
        if (source.isBool() && source.toBool() != sourceEnabled) {
            fail(QStringLiteral(
                "Source setting does not match installed source selection"));
        }
    }
    const QJsonValue modBridgeValue =
        manifest.value(QStringLiteral("modBridge"));
    if (!modBridgeValue.isUndefined()) {
        if (!modBridgeValue.isObject()) {
            fail(QStringLiteral(
                "Invalid KD Hybrid bridge mod in installation manifest"));
        }
        const QJsonObject modBridge = modBridgeValue.toObject();
        if (modBridge.value(QStringLiteral("path")).toString()
                != QLatin1String(kBridgeModRelativePath)
            || !modBridge.value(QStringLiteral("sha256")).isString()
            || !hashPattern.match(
                    modBridge.value(QStringLiteral("sha256")).toString())
                    .hasMatch()
            || !validBytes(modBridge.value(QStringLiteral("bytes")))) {
            fail(QStringLiteral(
                "Invalid KD Hybrid bridge mod in installation manifest"));
        }
        resolveBridgeModPath(
            appRoot, modBridge.value(QStringLiteral("path")).toString());
    }
    return manifest;
}

QString portablePath(QString value)
{
    return value.replace(QChar(u'\\'), QChar(u'/'));
}

QJsonObject embeddedFileRecord(const QString& relativePath)
{
    const QByteArray bytes = readAll(QStringLiteral(":/bootstrap/") + relativePath);
    return {
        {QStringLiteral("path"),
         QStringLiteral("%1/%2").arg(kDestinationDirectory, relativePath)},
        {QStringLiteral("sha256"), sha256(bytes)},
        {QStringLiteral("bytes"), static_cast<double>(bytes.size())},
    };
}

void auditManagedPayload(const QString& appRoot,
                         const QJsonArray& records,
                         QStringList& problems)
{
    QHash<QString, QJsonObject> expected;
    QSet<QString> expectedDirectories{QString::fromLatin1(kDestinationDirectory)};
    for (const QJsonValue& value : records) {
        const QJsonObject record = value.toObject();
        const QString path = record.value(QStringLiteral("path")).toString();
        expected.insert(path, record);
        const QStringList parts = path.split(QLatin1Char('/'));
        for (qsizetype index = 1; index < parts.size(); ++index) {
            expectedDirectories.insert(parts.sliced(0, index).join(QLatin1Char('/')));
        }
    }
    const QString root = resolveSafeManagedDirectory(
        appRoot, QString::fromLatin1(kDestinationDirectory), false);
    if (!QFileInfo::exists(root)) {
        for (auto it = expected.cbegin(); it != expected.cend(); ++it) {
            problems.append(it.key() + QStringLiteral(" is missing"));
        }
        return;
    }

    QHash<QString, QFileInfo> actual;
    const auto walk = [&](const auto& self, const QString& directory,
                          const QString& relativeDirectory) -> void {
        const QFileInfoList entries = QDir(directory).entryInfoList(
            QDir::AllEntries | QDir::NoDotAndDotDot | QDir::Hidden
                | QDir::System,
            QDir::Name);
        for (const QFileInfo& info : entries) {
            const QString relativePath = relativeDirectory + QLatin1Char('/')
                + info.fileName();
            if (info.isSymLink()
                || QDir::cleanPath(info.canonicalFilePath())
                       .compare(QDir::cleanPath(info.absoluteFilePath()),
                                pathCaseSensitivity()) != 0) {
                fail(QStringLiteral("Managed payload link is forbidden: %1")
                         .arg(relativePath));
            }
            if (info.isDir()) {
                if (!expectedDirectories.contains(relativePath)) {
                    problems.append(relativePath
                                    + QStringLiteral(" is an unexpected payload directory"));
                }
                self(self, info.absoluteFilePath(), relativePath);
            } else if (info.isFile()) {
                actual.insert(relativePath, info);
            } else {
                fail(QStringLiteral("Unsupported managed payload entry: %1")
                         .arg(relativePath));
            }
        }
    };
    walk(walk, root, QString::fromLatin1(kDestinationDirectory));

    for (auto it = actual.cbegin(); it != actual.cend(); ++it) {
        if (!expected.contains(it.key())) {
            problems.append(
                it.key()
                + QStringLiteral(" is not recorded in the installation manifest"));
            continue;
        }
        const QJsonObject record = expected.value(it.key());
        if (it.value().size()
                != static_cast<qint64>(
                    record.value(QStringLiteral("bytes")).toDouble())
            || sha256File(it.value().absoluteFilePath())
                != record.value(QStringLiteral("sha256")).toString()) {
            problems.append(it.key() + QStringLiteral(" was modified"));
        }
    }
    for (auto it = expected.cbegin(); it != expected.cend(); ++it) {
        if (!actual.contains(it.key())) {
            problems.append(it.key() + QStringLiteral(" is missing"));
        }
    }
}

void copyPayload(const QString& appRoot, const QStringList& files)
{
    const QString destinationRoot = resolveSafeManagedDirectory(
        appRoot, QString::fromLatin1(kDestinationDirectory), false);
    if (QFileInfo::exists(destinationRoot)) {
        fail(QStringLiteral("Destination already exists: %1").arg(destinationRoot));
    }
    if (!QDir().mkpath(destinationRoot)) {
        fail(QStringLiteral("Could not create payload directory: %1")
                 .arg(destinationRoot));
    }
    for (const QString& relativePath : files) {
        const QByteArray bytes =
            readAll(QStringLiteral(":/bootstrap/") + relativePath);
        const QString destination = resolveSafeManagedFile(
            appRoot, QStringLiteral("%1/%2")
                         .arg(kDestinationDirectory, relativePath), false);
        atomicWrite(destination, bytes);
        if (sha256File(destination) != sha256(bytes)) {
            fail(QStringLiteral("Copied payload hash mismatch: %1")
                     .arg(relativePath));
        }
    }
}

QJsonObject bridgeModRecord()
{
    const QByteArray bytes =
        readAll(QStringLiteral(":/bootstrap/")
                + QString::fromLatin1(kBridgeModFileName));
    return {
        {QStringLiteral("path"),
         QString::fromLatin1(kBridgeModRelativePath)},
        {QStringLiteral("sha256"), sha256(bytes)},
        {QStringLiteral("bytes"), static_cast<double>(bytes.size())},
    };
}

void copyBridgeMod(const QString& appRoot)
{
    const QString target = resolveSafeBridgeModPath(appRoot, false);
    if (QFileInfo::exists(target)) {
        fail(QStringLiteral("Destination already exists: %1").arg(target));
    }
    const QByteArray bytes =
        readAll(QStringLiteral(":/bootstrap/")
                + QString::fromLatin1(kBridgeModFileName));
    atomicWrite(target, bytes);
    if (sha256File(target) != sha256(bytes)) {
        fail(QStringLiteral("Copied bridge mod hash mismatch: %1")
                 .arg(target));
    }
}

bool embeddedPayloadMatches(const QJsonObject& manifest)
{
    if (manifest.value(QStringLiteral("toolVersion")).toString()
            != QLatin1String(KD_MANAGER_VERSION)) {
        return false;
    }
    const QStringList files = payloadFiles();
    const QJsonArray installed =
        manifest.value(QStringLiteral("files")).toArray();
    if (installed.size() != files.size()) {
        return false;
    }
    QHash<QString, QJsonObject> installedByPath;
    for (const QJsonValue& value : installed) {
        const QJsonObject record = value.toObject();
        installedByPath.insert(
            record.value(QStringLiteral("path")).toString(), record);
    }
    for (const QString& relativePath : files) {
        const QJsonObject desired = embeddedFileRecord(relativePath);
        const QJsonObject actual = installedByPath.value(
            desired.value(QStringLiteral("path")).toString());
        if (actual.value(QStringLiteral("sha256")).toString()
                != desired.value(QStringLiteral("sha256")).toString()
            || actual.value(QStringLiteral("bytes")).toDouble()
                != desired.value(QStringLiteral("bytes")).toDouble()) {
            return false;
        }
    }
    const QJsonObject installedBridge =
        manifest.value(QStringLiteral("modBridge")).toObject();
    const QJsonObject desiredBridge = bridgeModRecord();
    return installedBridge.value(QStringLiteral("path")).toString()
            == desiredBridge.value(QStringLiteral("path")).toString()
        && installedBridge.value(QStringLiteral("sha256")).toString()
            == desiredBridge.value(QStringLiteral("sha256")).toString()
        && installedBridge.value(QStringLiteral("bytes")).toDouble()
            == desiredBridge.value(QStringLiteral("bytes")).toDouble();
}

void upgradeInstalledPayload(const kd::PatcherStatus& current)
{
    const QString& appRoot = current.inspection.appRoot;
    verifyWritableLayout(appRoot);
    verifyWritableBridgeLayout(appRoot);
    const QJsonObject currentBridge =
        current.manifest.value(QStringLiteral("modBridge")).toObject();
    const QString bridgeTarget =
        resolveSafeBridgeModPath(appRoot, !currentBridge.isEmpty());
    if (currentBridge.isEmpty() && QFileInfo::exists(bridgeTarget)) {
        fail(QStringLiteral("Destination already exists: %1")
                 .arg(bridgeTarget));
    }

    const QString manifestPath = resolveSafeManagedFile(
        appRoot, QString::fromLatin1(kManifestPath), true);
    const QString pendingPath = resolveSafeManagedFile(
        appRoot, QString::fromLatin1(kPendingPath), false);
    const QByteArray previousManifest = readAll(manifestPath);
    QHash<QString, QByteArray> previousFiles;
    for (const QJsonValue& value :
         current.manifest.value(QStringLiteral("files")).toArray()) {
        const QString relativePath =
            value.toObject().value(QStringLiteral("path")).toString();
        previousFiles.insert(relativePath,
                             readAll(resolveSafeManagedFile(
                                 appRoot, relativePath, true)));
    }
    const bool hadBridge = !currentBridge.isEmpty();
    const QByteArray previousBridge =
        hadBridge ? readAll(bridgeTarget) : QByteArray();

    const QStringList files = payloadFiles();
    QJsonArray installedFiles;
    QSet<QString> desiredPaths;
    for (const QString& relativePath : files) {
        const QJsonObject record = embeddedFileRecord(relativePath);
        installedFiles.append(record);
        desiredPaths.insert(
            record.value(QStringLiteral("path")).toString());
    }
    QJsonObject updatedManifest = current.manifest;
    updatedManifest.insert(QStringLiteral("toolVersion"),
                           QString::fromLatin1(KD_MANAGER_VERSION));
    updatedManifest.insert(QStringLiteral("files"), installedFiles);
    updatedManifest.insert(QStringLiteral("modBridge"), bridgeModRecord());

    atomicWriteJson(pendingPath, updatedManifest);
    try {
        for (const QString& relativePath : files) {
            const QByteArray bytes =
                readAll(QStringLiteral(":/bootstrap/") + relativePath);
            const QString target = resolveSafeManagedFile(
                appRoot, QStringLiteral("%1/%2")
                             .arg(kDestinationDirectory, relativePath), false);
            atomicWrite(target, bytes);
            if (sha256File(target) != sha256(bytes)) {
                fail(QStringLiteral("Upgraded payload hash mismatch: %1")
                         .arg(relativePath));
            }
        }
        for (auto it = previousFiles.cbegin();
             it != previousFiles.cend(); ++it) {
            const QString obsolete = resolveSafeManagedFile(
                appRoot, it.key(), true);
            if (!desiredPaths.contains(it.key())
                && QFileInfo::exists(obsolete)
                && !QFile::remove(obsolete)) {
                fail(QStringLiteral("Could not remove obsolete payload: %1")
                         .arg(it.key()));
            }
        }
        const QByteArray bridgeBytes =
            readAll(QStringLiteral(":/bootstrap/")
                    + QString::fromLatin1(kBridgeModFileName));
        atomicWrite(bridgeTarget, bridgeBytes);
        if (sha256File(bridgeTarget) != sha256(bridgeBytes)) {
            fail(QStringLiteral("Upgraded bridge mod hash mismatch"));
        }
        atomicWriteJson(manifestPath, updatedManifest);
        if (!QFile::remove(pendingPath)) {
            fail(QStringLiteral(
                     "Upgrade succeeded, but could not remove pending journal: %1")
                     .arg(pendingPath));
        }
    } catch (...) {
        const std::exception_ptr original = std::current_exception();
        try {
            for (const QString& relativePath : files) {
                const QString installedPath =
                    QStringLiteral("%1/%2")
                        .arg(kDestinationDirectory, relativePath);
                const QString target = resolveSafeManagedFile(
                    appRoot, installedPath, false);
                if (previousFiles.contains(installedPath)) {
                    atomicWrite(target,
                                previousFiles.value(installedPath));
                } else if (QFileInfo::exists(target)) {
                    QFile::remove(target);
                }
            }
            for (auto it = previousFiles.cbegin();
                 it != previousFiles.cend(); ++it) {
                if (!desiredPaths.contains(it.key())) {
                    atomicWrite(resolveSafeManagedFile(
                                    appRoot, it.key(), false),
                                it.value());
                }
            }
            if (hadBridge) {
                atomicWrite(bridgeTarget, previousBridge);
            } else if (QFileInfo::exists(bridgeTarget)) {
                QFile::remove(bridgeTarget);
            }
            atomicWrite(manifestPath, previousManifest);
            QFile::remove(pendingPath);
        } catch (...) {
            // Keep the journal when rollback itself cannot complete.
        }
        std::rethrow_exception(original);
    }
}

bool needsActiveSourceMigration(const QJsonObject& manifest)
{
    const QJsonObject sourcePatch =
        manifest.value(QStringLiteral("sourcePatch")).toObject();
    if (sourcePatch.isEmpty()) {
        return false;
    }
    const std::optional<kd::SourceBundleMatch> active =
        kd::findKnownSourceBundle(
            sourcePatch.value(QStringLiteral("originalSha256")).toString());
    if (!active.has_value() || active->sourcePatched) {
        return false;
    }
    const QJsonArray installedFiles = sourceFilesFromManifest(sourcePatch);
    if (sourcePatch.value(QStringLiteral("id")).toString()
            != active->patch.id
        || installedFiles.size() != active->patch.files.size()) {
        return true;
    }
    for (const kd::SourcePatchFileInfo& expected : active->patch.files) {
        bool matched = false;
        for (const QJsonValue& value : installedFiles) {
            const QJsonObject file = value.toObject();
            if (file.value(QStringLiteral("path")).toString() == expected.path
                && file.value(QStringLiteral("patchedSha256")).toString()
                    == expected.outputSha256) {
                matched = true;
                break;
            }
        }
        if (!matched) {
            return true;
        }
    }
    return false;
}

QByteArray updateIndexSourceSelection(const QByteArray& indexBytes,
                                      bool knownBuild,
                                      bool enabled)
{
    QString text = QString::fromUtf8(
        kd::ensureModernMobileMeta(indexBytes, knownBuild));
    const QRegularExpression configPattern(
        QStringLiteral(
            R"(<script>globalThis\.KDHybridBootstrapConfig=Object\.freeze\((\{[^<]*\})\);</script>)"));
    const QRegularExpressionMatch match = configPattern.match(text);
    if (!match.hasMatch()) {
        fail(QStringLiteral(
            "Could not locate KD Hybrid bootstrap configuration during source migration"));
    }
    QJsonParseError error;
    const QJsonDocument document =
        QJsonDocument::fromJson(match.captured(1).toUtf8(), &error);
    if (error.error != QJsonParseError::NoError || !document.isObject()) {
        fail(QStringLiteral("Invalid KD Hybrid bootstrap configuration"));
    }
    QJsonObject config = document.object();
    config.insert(QStringLiteral("sourceOptimizations"), enabled);
    const QString replacement =
        QStringLiteral(
            "<script>globalThis.KDHybridBootstrapConfig=Object.freeze(%1);"
            "</script>")
            .arg(inlineJson(config));
    text.replace(match.capturedStart(), match.capturedLength(), replacement);
    return text.toUtf8();
}

void migrateActiveSourcePatch(const kd::PatcherStatus& current)
{
    const QString& appRoot = current.inspection.appRoot;
    const QJsonObject oldPatch =
        current.manifest.value(QStringLiteral("sourcePatch")).toObject();
    const bool oldEnabled = !oldPatch.contains(QStringLiteral("enabled"))
        || oldPatch.value(QStringLiteral("enabled")).toBool();
    const std::optional<kd::SourcePatchInfo> legacy =
        kd::findKnownSourcePatchById(
            oldPatch.value(QStringLiteral("id")).toString());
    if (!legacy.has_value()
        || legacy->inputSha256
               != oldPatch.value(QStringLiteral("originalSha256")).toString()
        || legacy->outputSha256
               != oldPatch.value(QStringLiteral("patchedSha256")).toString()
        || legacy->upstreamVersion
               != oldPatch.value(QStringLiteral("upstreamVersion")).toString()
        || legacy->sourceUrl
               != oldPatch.value(QStringLiteral("sourceUrl")).toString()) {
        fail(QStringLiteral(
            "Installed source patch is not a verified migration source"));
    }
    const QJsonArray oldFiles = sourceFilesFromManifest(oldPatch);
    QHash<QString, QJsonObject> oldByPath;
    for (const QJsonValue& value : oldFiles) {
        const QJsonObject file = value.toObject();
        oldByPath.insert(file.value(QStringLiteral("path")).toString(), file);
    }
    const QJsonObject oldPrimary = oldByPath.value(QStringLiteral("out/main.js"));
    const QByteArray primaryOriginal = readAll(resolveSafeSourceBackup(
        appRoot, oldPrimary.value(QStringLiteral("backupPath")).toString(),
        true));
    if (sha256(primaryOriginal)
        != oldPrimary.value(QStringLiteral("originalSha256")).toString()) {
        fail(QStringLiteral("Original out/main.js backup hash does not match the manifest"));
    }
    const std::optional<kd::SourceBundleMatch> activeMatch =
        kd::findKnownSourceBundle(sha256(primaryOriginal));
    if (!activeMatch.has_value() || activeMatch->sourcePatched) {
        fail(QStringLiteral("No active source patch accepts the verified backup"));
    }

    struct MigrationFile {
        kd::SourcePatchFileInfo info;
        QString backupPath;
        QByteArray original;
        QByteArray before;
        bool createBackup = false;
    };
    QList<MigrationFile> files;
    QList<kd::SourcePatchInput> inputs;
    QStringList newBackups;
    const QString installationId =
        current.manifest.value(QStringLiteral("id")).toString();
    for (const kd::SourcePatchFileInfo& expected : activeMatch->patch.files) {
        const QString target = resolveSafeSourceFile(appRoot, expected.path);
        verifyWritableFile(target);
        const QByteArray before = readAll(target);
        const QJsonObject old = oldByPath.value(expected.path);
        QByteArray original;
        QString backupRelative;
        if (old.isEmpty()) {
            original = before;
            backupRelative = sourceBackupRelative(installationId, expected.path);
            if (sha256(before) != expected.inputSha256) {
                fail(QStringLiteral("Refusing to patch modified auxiliary source file %1")
                         .arg(expected.path));
            }
        } else {
            backupRelative = old.value(QStringLiteral("backupPath")).toString();
            original = readAll(resolveSafeSourceBackup(
                appRoot, backupRelative, true));
            const QString expectedCurrent = oldEnabled
                ? old.value(QStringLiteral("patchedSha256")).toString()
                : old.value(QStringLiteral("originalSha256")).toString();
            if (sha256(before) != expectedCurrent) {
                fail(QStringLiteral("%1 changed during source patch migration")
                         .arg(expected.path));
            }
        }
        if (sha256(original) != expected.inputSha256) {
            fail(QStringLiteral("Source patch input hash mismatch for %1")
                     .arg(expected.path));
        }
        const QString backupPath = resolveSafeSourceBackup(
            appRoot, backupRelative, old.isEmpty() ? false : true);
        if (old.isEmpty()) {
            if (QFileInfo::exists(backupPath)) {
                if (sha256File(backupPath) != expected.inputSha256) {
                    fail(QStringLiteral("Refusing mismatched source backup %1")
                             .arg(backupRelative));
                }
            } else {
                newBackups.append(backupPath);
            }
        }
        files.append({expected, backupRelative, original, before,
                      old.isEmpty() && !QFileInfo::exists(backupPath)});
        inputs.append({expected.path, original, expected.inputSha256});
    }
    const kd::SourcePatchResult result =
        kd::applyKnownSourcePatchFiles(inputs);
    if (!result.applied || result.patch.id != activeMatch->patch.id) {
        fail(QStringLiteral("Active source patch selection changed during migration"));
    }

    QHash<QString, kd::SourcePatchOutput> outputs;
    QJsonArray manifestFiles;
    for (const kd::SourcePatchOutput& output : result.files) {
        outputs.insert(output.info.path, output);
        const auto record = std::find_if(
            files.cbegin(), files.cend(), [&](const MigrationFile& file) {
                return file.info.path == output.info.path;
            });
        manifestFiles.append(QJsonObject{
            {QStringLiteral("path"), output.info.path},
            {QStringLiteral("backupPath"), record->backupPath},
            {QStringLiteral("originalSha256"), output.info.inputSha256},
            {QStringLiteral("patchedSha256"), output.info.outputSha256},
        });
    }
    const QJsonObject primary = manifestFiles.first().toObject();
    QJsonObject newPatch{
        {QStringLiteral("id"), result.patch.id},
        {QStringLiteral("path"), QStringLiteral("out/main.js")},
        {QStringLiteral("backupPath"),
         files.first().info.path == QLatin1String("out/main.js")
             ? files.first().backupPath
             : primary.value(QStringLiteral("backupPath"))},
        {QStringLiteral("originalSha256"), result.patch.inputSha256},
        {QStringLiteral("patchedSha256"), result.patch.outputSha256},
        {QStringLiteral("upstreamVersion"), result.patch.upstreamVersion},
        {QStringLiteral("sourceUrl"), result.patch.sourceUrl},
    };
    if (manifestFiles.size() > 1) {
        newPatch.insert(QStringLiteral("files"), manifestFiles);
    }
    if (oldPatch.contains(QStringLiteral("enabled"))) {
        newPatch.insert(QStringLiteral("enabled"), true);
    }

    struct RetiredFile {
        QString path;
        QByteArray before;
        QByteArray original;
    };
    QList<RetiredFile> retiredFiles;
    QSet<QString> activePaths;
    for (const MigrationFile& file : files) {
        activePaths.insert(file.info.path);
    }
    for (auto it = oldByPath.cbegin(); it != oldByPath.cend(); ++it) {
        if (activePaths.contains(it.key())) {
            continue;
        }
        const QJsonObject old = it.value();
        const QByteArray original = readAll(resolveSafeSourceBackup(
            appRoot, old.value(QStringLiteral("backupPath")).toString(), true));
        if (sha256(original)
            != old.value(QStringLiteral("originalSha256")).toString()) {
            fail(QStringLiteral("Original %1 backup hash does not match the manifest")
                     .arg(it.key()));
        }
        const QByteArray before =
            readAll(resolveSafeSourceFile(appRoot, it.key()));
        const QString expectedCurrent = oldEnabled
            ? old.value(QStringLiteral("patchedSha256")).toString()
            : old.value(QStringLiteral("originalSha256")).toString();
        if (sha256(before) != expectedCurrent) {
            fail(QStringLiteral("%1 changed during source patch migration")
                     .arg(it.key()));
        }
        retiredFiles.append({it.key(), before, original});
    }

    const QJsonObject index =
        current.manifest.value(QStringLiteral("index")).toObject();
    const QString indexPath = resolveSafeManagedFile(
        appRoot, index.value(QStringLiteral("path")).toString(), true);
    const QByteArray previousIndex = readAll(indexPath);
    const QByteArray updatedIndex = updateIndexSourceSelection(
        previousIndex,
        current.manifest.value(QStringLiteral("upstream"))
            .toObject().value(QStringLiteral("known")).toBool(),
        true);
    QJsonObject manifest = current.manifest;
    QJsonObject updatedIndexRecord = index;
    updatedIndexRecord.insert(QStringLiteral("patchedSha256"),
                              sha256(updatedIndex));
    manifest.insert(QStringLiteral("index"), updatedIndexRecord);
    manifest.insert(QStringLiteral("sourcePatch"), newPatch);
    QJsonObject settings =
        manifest.value(QStringLiteral("settings")).toObject();
    settings.insert(QStringLiteral("sourceOptimizations"), true);
    manifest.insert(QStringLiteral("settings"), settings);
    const QString manifestPath = resolveSafeManagedFile(
        appRoot, QString::fromLatin1(kManifestPath), false);
    const QString pendingPath = resolveSafeManagedFile(
        appRoot, QString::fromLatin1(kPendingPath), false);
    const QByteArray previousManifest = readAll(manifestPath);
    atomicWriteJson(pendingPath, manifest);
    try {
        for (const MigrationFile& file : files) {
            if (file.createBackup) {
                writeExclusive(resolveSafeSourceBackup(
                                   appRoot, file.backupPath, false),
                               file.original);
                injectTestingFailure(
                    QStringLiteral("migration-after-source-backup"));
            }
        }
        for (const MigrationFile& file : files) {
            atomicWrite(resolveSafeSourceFile(appRoot, file.info.path),
                        outputs.value(file.info.path).bytes);
        }
        for (const RetiredFile& file : retiredFiles) {
            atomicWrite(resolveSafeSourceFile(appRoot, file.path),
                        file.original);
        }
        atomicWrite(indexPath, updatedIndex);
        atomicWriteJson(manifestPath, manifest);
        if (!QFile::remove(pendingPath)) {
            fail(QStringLiteral("Could not remove source migration journal"));
        }
    } catch (...) {
        const std::exception_ptr original = std::current_exception();
        try {
            for (const MigrationFile& file : files) {
                atomicWrite(resolveSafeSourceFile(appRoot, file.info.path),
                            file.before);
            }
            for (const RetiredFile& file : retiredFiles) {
                atomicWrite(resolveSafeSourceFile(appRoot, file.path),
                            file.before);
            }
            atomicWrite(indexPath, previousIndex);
            atomicWrite(manifestPath, previousManifest);
            for (const QString& backup : newBackups) {
                if (QFileInfo::exists(backup) && !QFile::remove(backup)) {
                    fail(QStringLiteral("Could not remove migration backup %1")
                             .arg(backup));
                }
            }
            if (QFileInfo::exists(pendingPath)
                && !QFile::remove(pendingPath)) {
                fail(QStringLiteral("Could not remove migration journal"));
            }
        } catch (...) {
            // Keep the journal when rollback itself cannot complete.
        }
        std::rethrow_exception(original);
    }
}

QString stateName(kd::PatcherState state)
{
    switch (state) {
    case kd::PatcherState::NotInstalled:
        return QStringLiteral("not-installed");
    case kd::PatcherState::Installed:
        return QStringLiteral("installed");
    case kd::PatcherState::Modified:
        return QStringLiteral("modified");
    case kd::PatcherState::Incomplete:
        return QStringLiteral("incomplete");
    }
    return QStringLiteral("incomplete");
}

} // namespace

namespace kd {

PatcherError::PatcherError(PatcherErrorCode code, const QString& message)
    : std::runtime_error(message.toUtf8().constData()), code_(code)
{
}

PatcherErrorCode PatcherError::code() const noexcept
{
    return code_;
}

std::optional<KnownBundleMetadata>
findKnownBundleMetadata(const QString& bundleSha256)
{
    const auto known = std::find_if(
        std::begin(kKnownBundles), std::end(kKnownBundles),
        [&](const KnownBundle& bundle) {
            return bundleSha256.compare(QString::fromLatin1(bundle.sha256),
                                        Qt::CaseInsensitive) == 0;
        });
    if (known == std::end(kKnownBundles)) {
        return std::nullopt;
    }
    return KnownBundleMetadata{
        QString::fromLatin1(known->gameVersion),
        QString::fromLatin1(known->packageVersion),
        QString::fromLatin1(known->sha256),
    };
}

QByteArray ensureModernMobileMeta(const QByteArray& indexBytes,
                                  bool knownBuild)
{
    if (!knownBuild) {
        return indexBytes;
    }
    const QString text = QString::fromUtf8(indexBytes);
    const QRegularExpression tagPattern(
        QStringLiteral(R"(<meta\b[^>]*>)"),
        QRegularExpression::CaseInsensitiveOption);
    const QRegularExpression namePattern(
        QStringLiteral(R"(\bname\s*=\s*(["'])([^"']+)\1)"),
        QRegularExpression::CaseInsensitiveOption);
    QList<QRegularExpressionMatch> legacy;
    bool modern = false;
    auto matches = tagPattern.globalMatch(text);
    while (matches.hasNext()) {
        const QRegularExpressionMatch tag = matches.next();
        const QRegularExpressionMatch name =
            namePattern.match(tag.captured());
        if (!name.hasMatch()) {
            continue;
        }
        const QString value = name.captured(2).toLower();
        if (value == QLatin1String("mobile-web-app-capable")) {
            modern = true;
        } else if (value
                   == QLatin1String("apple-mobile-web-app-capable")) {
            legacy.append(tag);
        }
    }
    if (modern) {
        return indexBytes;
    }
    if (legacy.size() != 1) {
        fail(QStringLiteral(
            "Known KD index has an ambiguous mobile web app capability structure"));
    }
    const QRegularExpressionMatch match = legacy.first();
    const qsizetype lineStart = text.lastIndexOf(QChar(u'\n'),
                                                 match.capturedStart() - 1)
        + 1;
    const QString prefix =
        text.sliced(lineStart, match.capturedStart() - lineStart);
    static const QRegularExpression indentationPattern(
        QStringLiteral("^[\\t ]*$"));
    const QString indentation = indentationPattern.match(prefix).hasMatch()
        ? prefix
        : QString();
    const QString lineEnding = indexBytes.contains("\r\n")
        ? QStringLiteral("\r\n")
        : QStringLiteral("\n");
    QString result = text;
    result.insert(
        match.capturedEnd(),
        lineEnding + indentation
            + QStringLiteral(
                "<meta name=\"mobile-web-app-capable\" content=\"yes\">"));
    return result.toUtf8();
}

QString Patcher::normalizeAppRoot(const QString& selectedPath)
{
    QFileInfo selected(selectedPath);
    QString candidate = selected.isFile() ? selected.absolutePath() : selectedPath;
    candidate = QDir::cleanPath(QFileInfo(candidate).absoluteFilePath());

    const auto isAppRoot = [](const QString& path) {
        return QFileInfo(QDir(path).filePath(QStringLiteral("index.html"))).isFile()
            && QFileInfo(QDir(path).filePath(QStringLiteral("out/main.js")))
                   .isFile();
    };
    if (!isAppRoot(candidate)) {
        const QString nested =
            QDir(candidate).filePath(QStringLiteral("resources/app"));
        if (isAppRoot(nested)) {
            candidate = nested;
        }
    }
    const QString canonical = canonicalDirectory(candidate);
    validateLayout(canonical);
    return canonical;
}

Inspection Patcher::inspect(const QString& selectedPath)
{
    Inspection result;
    result.appRoot = normalizeAppRoot(selectedPath);
    result.bundleSha256 = sha256File(resolveSafeManagedFile(
        result.appRoot, QStringLiteral("out/main.js"), true));
    const std::optional<SourceBundleMatch> sourceBundle =
        findKnownSourceBundle(result.bundleSha256);
    if (sourceBundle.has_value()) {
        result.knownBundle = true;
        result.sourcePatched = sourceBundle->sourcePatched;
        result.gameVersion = sourceBundle->patch.upstreamVersion;
        result.packageVersion = sourceBundle->patch.packageVersion;
    } else {
        const std::optional<KnownBundleMetadata> known =
            findKnownBundleMetadata(result.bundleSha256);
        if (known.has_value()) {
            result.knownBundle = true;
            result.gameVersion = known->gameVersion;
            result.packageVersion = known->packageVersion;
        }
    }
    return result;
}

PatcherStatus Patcher::status(const QString& selectedPath)
{
    PatcherStatus result;
    result.inspection = inspect(selectedPath);
    const QString& appRoot = result.inspection.appRoot;
    validateOptionalManagedDirectory(
        appRoot, QString::fromLatin1(kStateDirectory));
    validateOptionalManagedDirectory(
        appRoot, QString::fromLatin1(kDestinationDirectory));
    const QString manifestPath = resolveSafeManagedFile(
        appRoot, QString::fromLatin1(kManifestPath), false);
    const QString pendingPath = resolveSafeManagedFile(
        appRoot, QString::fromLatin1(kPendingPath), false);
    if (!QFileInfo::exists(manifestPath)) {
        if (QFileInfo::exists(pendingPath)) {
            result.state = PatcherState::Incomplete;
            result.problems.append(
                QStringLiteral("pending installation manifest exists"));
        } else {
            result.state = PatcherState::NotInstalled;
        }
        return result;
    }

    result.manifest =
        validateManifest(readJsonObject(manifestPath), appRoot);
    if (QFileInfo::exists(pendingPath)) {
        result.problems.append(
            QStringLiteral("pending installation manifest exists"));
    }
    const QJsonObject index =
        result.manifest.value(QStringLiteral("index")).toObject();
    const QString indexPath = resolveSafeManagedFile(
        appRoot, index.value(QStringLiteral("path")).toString(), true);
    if (sha256File(indexPath)
        != index.value(QStringLiteral("patchedSha256")).toString()) {
        result.problems.append(
            QStringLiteral("index.html changed after KD Hybrid installation"));
    }
    const QString indexBackup = resolveSafeManagedFile(
        appRoot, index.value(QStringLiteral("backupPath")).toString(), false);
    if (!QFileInfo::exists(indexBackup)) {
        result.problems.append(
            QStringLiteral("Original index.html backup is missing"));
    } else if (sha256File(indexBackup)
               != index.value(QStringLiteral("originalSha256")).toString()) {
        result.problems.append(QStringLiteral(
            "Original index.html backup hash does not match the manifest"));
    }
    auditManagedPayload(
        appRoot, result.manifest.value(QStringLiteral("files")).toArray(),
        result.problems);
    const QJsonObject modBridge =
        result.manifest.value(QStringLiteral("modBridge")).toObject();
    if (!modBridge.isEmpty()) {
        const QString relativePath =
            modBridge.value(QStringLiteral("path")).toString();
        const QString target = resolveSafeBridgeModPath(appRoot, false);
        const QFileInfo targetInfo(target);
        if (!targetInfo.exists()) {
            result.problems.append(relativePath
                                   + QStringLiteral(" is missing"));
        } else if (!targetInfo.isFile() || targetInfo.isSymLink()
                   || sha256File(target)
                       != modBridge.value(QStringLiteral("sha256"))
                              .toString()) {
            result.problems.append(relativePath
                                   + QStringLiteral(" was modified"));
        }
    }
    const QJsonObject upstream =
        result.manifest.value(QStringLiteral("upstream")).toObject();
    const QJsonObject sourcePatch =
        result.manifest.value(QStringLiteral("sourcePatch")).toObject();
    if (!sourcePatch.isEmpty()) {
        const bool enabled =
            !sourcePatch.contains(QStringLiteral("enabled"))
            || sourcePatch.value(QStringLiteral("enabled")).toBool();
        for (const QJsonValue& value : sourceFilesFromManifest(sourcePatch)) {
            const QJsonObject file = value.toObject();
            const QString relativePath =
                file.value(QStringLiteral("path")).toString();
            const QString backupRelative =
                file.value(QStringLiteral("backupPath")).toString();
            try {
                const QString backup = resolveSafeSourceBackup(
                    appRoot, backupRelative, true);
                if (sha256File(backup)
                    != file.value(QStringLiteral("originalSha256")).toString()) {
                    result.problems.append(
                        QStringLiteral("Original %1 backup hash does not match the manifest")
                            .arg(relativePath));
                }
                const QString target =
                    resolveSafeSourceFile(appRoot, relativePath);
                const QString expected = enabled
                    ? file.value(QStringLiteral("patchedSha256")).toString()
                    : file.value(QStringLiteral("originalSha256")).toString();
                if (sha256File(target) != expected) {
                    result.problems.append(
                        relativePath
                        + QStringLiteral(" changed after KD Hybrid installation"));
                }
            } catch (const std::exception&) {
                result.problems.append(
                    relativePath + QStringLiteral(" is unsafe or missing"));
            }
        }
    } else if (sha256File(resolveSafeManagedFile(
                   appRoot,
                   upstream.value(QStringLiteral("bundlePath")).toString(),
                   true))
               != upstream.value(QStringLiteral("bundleSha256")).toString()) {
        result.problems.append(
            QStringLiteral("out/main.js changed after KD Hybrid installation"));
    }
    result.state = QFileInfo::exists(pendingPath)
        ? PatcherState::Incomplete
        : result.problems.isEmpty() ? PatcherState::Installed
                                     : PatcherState::Modified;
    result.upgradeAvailable =
        result.state == PatcherState::Installed
        && !embeddedPayloadMatches(result.manifest);
    return result;
}

PatcherStatus Patcher::install(const QString& selectedPath,
                               bool allowUnknownBundle,
                               const QString& pathfindingModeInput,
                               const QString& textureModeInput,
                               std::optional<bool> sourceOptimizationsInput)
{
    const QString pathfindingMode =
        validatePathfindingMode(pathfindingModeInput);
    const QString textureMode = validateTextureMode(textureModeInput);
    PatcherStatus current = status(selectedPath);
    if (current.state == PatcherState::Installed) {
        const QJsonObject initialSource =
            current.manifest.value(QStringLiteral("sourcePatch")).toObject();
        const bool initialSourceEnabled = !initialSource.isEmpty()
            && (!initialSource.contains(QStringLiteral("enabled"))
                || initialSource.value(QStringLiteral("enabled")).toBool());
        const bool requestedSourceOptimizations =
            sourceOptimizationsInput.value_or(initialSourceEnabled);
        if (requestedSourceOptimizations
            && needsActiveSourceMigration(current.manifest)) {
            migrateActiveSourcePatch(current);
            current = status(selectedPath);
        }
        const QJsonObject currentSource =
            current.manifest.value(QStringLiteral("sourcePatch")).toObject();
        const bool currentSourceEnabled = !currentSource.isEmpty()
            && (!currentSource.contains(QStringLiteral("enabled"))
                || currentSource.value(QStringLiteral("enabled")).toBool());
        const std::optional<SourceBundleMatch> currentSourceMatch =
            findKnownSourceBundle(
                current.manifest.value(QStringLiteral("upstream"))
                    .toObject()
                    .value(QStringLiteral("bundleSha256"))
                    .toString());
        const bool canEnableSource = !currentSource.isEmpty()
            || (currentSourceMatch.has_value()
                && !currentSourceMatch->sourcePatched);
        if (sourceOptimizationsInput.has_value()
            && currentSourceEnabled != *sourceOptimizationsInput
            && (!*sourceOptimizationsInput || canEnableSource)) {
            current = updateConfiguration(current.inspection.appRoot, {}, {},
                                          *sourceOptimizationsInput);
        }
        if (!current.upgradeAvailable) {
            return current;
        }
        upgradeInstalledPayload(current);
        return status(selectedPath);
    }
    if (current.state != PatcherState::NotInstalled) {
        fail(QStringLiteral("Refusing install over %1 patcher state: %2")
                 .arg(stateName(current.state), current.problems.join("; ")));
    }
    const Inspection inspection = current.inspection;
    if (!inspection.knownBundle && !allowUnknownBundle) {
        fail(QStringLiteral(
                 "Unknown out/main.js SHA-256 %1; this manager only patches "
                 "verified game builds")
                 .arg(inspection.bundleSha256));
    }
    if (inspection.sourcePatched) {
        fail(QStringLiteral(
            "out/main.js already contains the recognized source patch but "
            "has no installation manifest or original backup"));
    }
    verifyWritableLayout(inspection.appRoot);
    verifyWritableBridgeLayout(inspection.appRoot);

    const QStringList files = payloadFiles();
    const QString bridgeModPath =
        resolveSafeBridgeModPath(inspection.appRoot, false);
    if (QFileInfo::exists(bridgeModPath)) {
        fail(QStringLiteral("Destination already exists: %1")
                 .arg(bridgeModPath));
    }
    const QString bundlePath = resolveSafeManagedFile(
        inspection.appRoot, QStringLiteral("out/main.js"), true);
    const QByteArray originalBundle = readAll(bundlePath);
    SourcePatchResult sourcePatch;
    QHash<QString, QByteArray> originalSourceFiles;
    const std::optional<SourceBundleMatch> sourceMatch =
        findKnownSourceBundle(inspection.bundleSha256);
    if (sourceMatch.has_value() && !sourceMatch->sourcePatched) {
        QList<SourcePatchInput> inputs;
        for (const SourcePatchFileInfo& file : sourceMatch->patch.files) {
            const QString target =
                resolveSafeSourceFile(inspection.appRoot, file.path);
            verifyWritableFile(target);
            const QByteArray bytes = readAll(target);
            if (sha256(bytes) != file.inputSha256) {
                fail(QStringLiteral("Source patch %1 requires exact input %2")
                         .arg(sourceMatch->patch.id, file.path));
            }
            inputs.append({file.path, bytes, file.inputSha256});
            originalSourceFiles.insert(file.path, bytes);
        }
        sourcePatch = applyKnownSourcePatchFiles(inputs);
    }
    const bool sourceOptimizations =
        sourceOptimizationsInput.value_or(true) && sourcePatch.applied;
    const QString indexPath = resolveSafeManagedFile(
        inspection.appRoot, QStringLiteral("index.html"), true);
    const QByteArray originalIndex = readAll(indexPath);
    QString originalText = QString::fromUtf8(ensureModernMobileMeta(
        originalIndex, inspection.knownBundle));
    if (originalText.contains(QLatin1String(kBootstrapScript))) {
        fail(QStringLiteral(
            "index.html already contains a KD Hybrid bootstrap without a manifest"));
    }

    const QRegularExpression scriptPattern(
        QStringLiteral(
            R"(<script\b[^>]*\bsrc=(["'])\.?/?out/main\.js\1[^>]*></script>)"),
        QRegularExpression::CaseInsensitiveOption
            | QRegularExpression::UseUnicodePropertiesOption);
    auto matches = scriptPattern.globalMatch(originalText);
    QList<QRegularExpressionMatch> found;
    while (matches.hasNext()) {
        found.append(matches.next());
    }
    if (found.size() != 1) {
        fail(QStringLiteral(
            "Could not uniquely locate ./out/main.js in index.html"));
    }

    QJsonObject config{
        {QStringLiteral("upstreamVersion"),
         inspection.knownBundle ? QJsonValue(inspection.gameVersion)
                                : QJsonValue(QJsonValue::Null)},
        {QStringLiteral("upstreamPackageVersion"),
         inspection.knownBundle ? QJsonValue(inspection.packageVersion)
                                : QJsonValue(QJsonValue::Null)},
        {QStringLiteral("upstreamBundleSha256"), inspection.bundleSha256},
        {QStringLiteral("quality"), QStringLiteral("auto")},
        {QStringLiteral("pathfindingMode"), pathfindingMode},
        {QStringLiteral("sourceOptimizations"), sourceOptimizations},
    };
    if (textureMode != QLatin1String("auto")) {
        config.insert(
            QStringLiteral("rendering"),
            QJsonObject{{QStringLiteral("textureMode"), textureMode}});
    }
    const QString injection =
        QStringLiteral(
            "<script>globalThis.KDHybridBootstrapConfig=Object.freeze(%1);"
            "</script><script src=\"./%2\"></script>")
            .arg(inlineJson(config), QString::fromLatin1(kBootstrapScript));
    originalText.replace(found.first().capturedStart(),
                         found.first().capturedLength(),
                         injection + found.first().captured());
    const QByteArray patchedIndex = originalText.toUtf8();

    const QString id =
        QDateTime::currentDateTimeUtc().toString(
            QStringLiteral("yyyy-MM-dd'T'HH-mm-ss-zzz'Z'"))
        + QStringLiteral("-")
        + QUuid::createUuid().toString(QUuid::WithoutBraces);
    const QString backupRelative =
        QStringLiteral("%1/backups/%2/index.html").arg(kStateDirectory, id);
    const QString backupPath = resolveSafeManagedFile(
        inspection.appRoot, backupRelative, false);
    QJsonObject sourcePatchManifest = sourcePatch.manifest;
    if (sourcePatch.applied) {
        QJsonArray manifestFiles;
        for (const SourcePatchOutput& output : sourcePatch.files) {
            const QString sourceBackupRelativePath =
                sourceBackupRelative(id, output.info.path);
            resolveSafeSourceBackup(
                inspection.appRoot, sourceBackupRelativePath, false);
            QJsonObject record{
                {QStringLiteral("path"), output.info.path},
                {QStringLiteral("backupPath"), sourceBackupRelativePath},
                {QStringLiteral("originalSha256"),
                 output.info.inputSha256},
                {QStringLiteral("patchedSha256"),
                 output.info.outputSha256},
            };
            manifestFiles.append(record);
            if (output.info.path == QLatin1String("out/main.js")) {
                sourcePatchManifest.insert(QStringLiteral("backupPath"),
                                           sourceBackupRelativePath);
            }
        }
        if (manifestFiles.size() > 1) {
            sourcePatchManifest.insert(QStringLiteral("files"), manifestFiles);
        } else {
            sourcePatchManifest.remove(QStringLiteral("files"));
        }
        sourcePatchManifest.insert(QStringLiteral("enabled"),
                                   sourceOptimizations);
    }

    QJsonArray installedFiles;
    for (const QString& relativePath : files) {
        installedFiles.append(embeddedFileRecord(relativePath));
    }
    QJsonObject manifest{
        {QStringLiteral("schema"), 1},
        {QStringLiteral("id"), id},
        {QStringLiteral("toolVersion"),
         QString::fromLatin1(KD_MANAGER_VERSION)},
        {QStringLiteral("installedAt"),
         QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs)},
        {QStringLiteral("appRoot"), QStringLiteral(".")},
        {QStringLiteral("upstream"),
         QJsonObject{
             {QStringLiteral("version"),
              inspection.knownBundle ? QJsonValue(inspection.gameVersion)
                                     : QJsonValue(QJsonValue::Null)},
             {QStringLiteral("packageVersion"),
              inspection.knownBundle ? QJsonValue(inspection.packageVersion)
                                     : QJsonValue(QJsonValue::Null)},
             {QStringLiteral("bundlePath"), QStringLiteral("out/main.js")},
             {QStringLiteral("bundleSha256"), inspection.bundleSha256},
             {QStringLiteral("known"), inspection.knownBundle},
         }},
        {QStringLiteral("index"),
         QJsonObject{
             {QStringLiteral("path"), QStringLiteral("index.html")},
             {QStringLiteral("backupPath"), portablePath(backupRelative)},
             {QStringLiteral("originalSha256"), sha256(originalIndex)},
             {QStringLiteral("patchedSha256"), sha256(patchedIndex)},
         }},
        {QStringLiteral("files"), installedFiles},
        {QStringLiteral("modBridge"), bridgeModRecord()},
        {QStringLiteral("settings"),
         QJsonObject{
             {QStringLiteral("pathfindingMode"), pathfindingMode},
             {QStringLiteral("textureMode"), textureMode},
             {QStringLiteral("sourceOptimizations"), sourceOptimizations},
         }},
    };
    if (sourcePatch.applied) {
        manifest.insert(QStringLiteral("sourcePatch"), sourcePatchManifest);
    }

    const QString stateRoot = resolveSafeManagedDirectory(
        inspection.appRoot, QString::fromLatin1(kStateDirectory), false);
    if (!QDir().mkpath(stateRoot)) {
        fail(QStringLiteral("Could not create patcher state directory"));
    }
    const QString pendingPath = resolveSafeManagedFile(
        inspection.appRoot, QString::fromLatin1(kPendingPath), false);
    const QString manifestPath = resolveSafeManagedFile(
        inspection.appRoot, QString::fromLatin1(kManifestPath), false);
    atomicWriteJson(pendingPath, manifest);
    try {
        injectTestingFailure(QStringLiteral("fresh-before-backups"));
        writeExclusive(backupPath, originalIndex);
        injectTestingFailure(QStringLiteral("fresh-after-index-backup"));
        if (sourcePatch.applied) {
            for (const SourcePatchOutput& output : sourcePatch.files) {
                const QString sourceBackupRelativePath =
                    sourceBackupRelative(id, output.info.path);
                writeExclusive(
                    resolveSafeSourceBackup(inspection.appRoot,
                                            sourceBackupRelativePath, false),
                    originalSourceFiles.value(output.info.path));
                injectTestingFailure(
                    QStringLiteral("fresh-after-source-backup"));
            }
        }
        copyPayload(inspection.appRoot, files);
        copyBridgeMod(inspection.appRoot);
        if (sourceOptimizations) {
            for (const SourcePatchOutput& output : sourcePatch.files) {
                atomicWrite(resolveSafeSourceFile(inspection.appRoot,
                                                  output.info.path),
                            output.bytes);
            }
        }
        atomicWrite(indexPath, patchedIndex);
        atomicWriteJson(manifestPath, manifest);
        if (!QFile::remove(pendingPath)) {
            fail(QStringLiteral("Installed successfully, but could not remove "
                                "the pending installation journal: %1")
                     .arg(pendingPath));
        }
    } catch (...) {
        const std::exception_ptr original = std::current_exception();
        try {
            for (auto it = originalSourceFiles.cbegin();
                 it != originalSourceFiles.cend(); ++it) {
                atomicWrite(resolveSafeSourceFile(inspection.appRoot, it.key()),
                            it.value());
            }
            atomicWrite(indexPath, originalIndex);
            if (QFileInfo::exists(manifestPath)
                && !QFile::remove(manifestPath)) {
                fail(QStringLiteral("Could not roll back installation manifest"));
            }
            const QString destination = resolveSafeManagedDirectory(
                inspection.appRoot,
                QString::fromLatin1(kDestinationDirectory), false);
            if (QFileInfo::exists(destination)
                && !QDir(destination).removeRecursively()) {
                fail(QStringLiteral("Could not roll back installed payload"));
            }
            if (QFileInfo::exists(bridgeModPath)
                && !QFile::remove(bridgeModPath)) {
                fail(QStringLiteral("Could not roll back bridge mod"));
            }
            const QString backupRoot = resolveSafeManagedDirectory(
                inspection.appRoot,
                QStringLiteral("%1/backups/%2").arg(kStateDirectory, id),
                false);
            if (QFileInfo::exists(backupRoot)
                && !QDir(backupRoot).removeRecursively()) {
                fail(QStringLiteral("Could not roll back installation backups"));
            }
            if (QFileInfo::exists(pendingPath)
                && !QFile::remove(pendingPath)) {
                fail(QStringLiteral("Could not remove rolled back install journal"));
            }
        } catch (...) {
            // Keep the journal when rollback itself cannot complete.
        }
        std::rethrow_exception(original);
    }
    return status(inspection.appRoot);
}

PatcherStatus Patcher::updateConfiguration(
    const QString& selectedPath,
    const QString& pathfindingModeInput,
    const QString& textureModeInput,
    std::optional<bool> sourceOptimizationsInput)
{
    PatcherStatus current = status(selectedPath);
    if (current.state != PatcherState::Installed
        || current.manifest.isEmpty()) {
        fail(QStringLiteral(
                 "Refusing settings update over %1 patcher state: %2")
                 .arg(stateName(current.state),
                       current.problems.join(QStringLiteral("; "))));
    }
    if (sourceOptimizationsInput.value_or(false)
        && needsActiveSourceMigration(current.manifest)) {
        migrateActiveSourcePatch(current);
        current = status(selectedPath);
    }
    const QString& appRoot = current.inspection.appRoot;
    verifyWritableLayout(appRoot);
    const QJsonObject index =
        current.manifest.value(QStringLiteral("index")).toObject();
    const QString indexPath = resolveSafeManagedFile(
        appRoot, index.value(QStringLiteral("path")).toString(), true);
    const QByteArray previousIndex = readAll(indexPath);
    const bool knownBuild = current.manifest.value(QStringLiteral("upstream"))
                                .toObject()
                                .value(QStringLiteral("known"))
                                .toBool();
    QString text = QString::fromUtf8(
        ensureModernMobileMeta(previousIndex, knownBuild));
    const QRegularExpression configPattern(
        QStringLiteral(
            R"(<script>globalThis\.KDHybridBootstrapConfig=Object\.freeze\((\{[^<]*\})\);</script>)"));
    const QRegularExpressionMatch match = configPattern.match(text);
    if (!match.hasMatch()) {
        fail(QStringLiteral(
            "Could not uniquely locate KD Hybrid bootstrap configuration"));
    }
    QJsonParseError parseError;
    const QJsonDocument document =
        QJsonDocument::fromJson(match.captured(1).toUtf8(), &parseError);
    if (parseError.error != QJsonParseError::NoError
        || !document.isObject()) {
        fail(QStringLiteral("Invalid KD Hybrid bootstrap configuration"));
    }
    QJsonObject config = document.object();
    const QJsonObject currentSettings =
        current.manifest.value(QStringLiteral("settings")).toObject();
    const QString pathfindingMode = validatePathfindingMode(
        pathfindingModeInput.isEmpty()
            ? currentSettings.value(QStringLiteral("pathfindingMode"))
                  .toString(QStringLiteral("fast"))
            : pathfindingModeInput);
    const QString textureMode = validateTextureMode(
        textureModeInput.isEmpty()
            ? currentSettings.value(QStringLiteral("textureMode"))
                  .toString(QStringLiteral("auto"))
            : textureModeInput);
    config.insert(QStringLiteral("pathfindingMode"), pathfindingMode);
    const QJsonObject installedSourcePatch =
        current.manifest.value(QStringLiteral("sourcePatch")).toObject();
    const bool currentSourceOptimizations =
        !installedSourcePatch.isEmpty()
        && (!installedSourcePatch.contains(QStringLiteral("enabled"))
            || installedSourcePatch.value(QStringLiteral("enabled")).toBool());
    const bool sourceOptimizations = sourceOptimizationsInput.value_or(
        currentSourceOptimizations);
    if (sourceOptimizations && installedSourcePatch.isEmpty()) {
        fail(QStringLiteral(
            "Source optimizations are unavailable for this installed bundle"));
    }
    config.insert(QStringLiteral("sourceOptimizations"), sourceOptimizations);
    QJsonObject rendering =
        config.value(QStringLiteral("rendering")).toObject();
    if (textureMode == QLatin1String("auto")) {
        rendering.remove(QStringLiteral("textureMode"));
    } else {
        rendering.insert(QStringLiteral("textureMode"), textureMode);
    }
    if (rendering.isEmpty()) {
        config.remove(QStringLiteral("rendering"));
    } else {
        config.insert(QStringLiteral("rendering"), rendering);
    }
    const QString replacement =
        QStringLiteral(
            "<script>globalThis.KDHybridBootstrapConfig=Object.freeze(%1);"
            "</script>")
            .arg(inlineJson(config));
    text.replace(match.capturedStart(), match.capturedLength(), replacement);
    const QByteArray patchedIndex = text.toUtf8();

    struct SourceUpdate {
        QString path;
        QByteArray before;
        QByteArray after;
    };
    QList<SourceUpdate> sourceUpdates;
    if (sourceOptimizations != currentSourceOptimizations) {
        QList<SourcePatchInput> inputs;
        for (const QJsonValue& value :
             sourceFilesFromManifest(installedSourcePatch)) {
            const QJsonObject file = value.toObject();
            const QString path = file.value(QStringLiteral("path")).toString();
            const QByteArray original = readAll(resolveSafeSourceBackup(
                appRoot,
                file.value(QStringLiteral("backupPath")).toString(), true));
            if (sha256(original)
                != file.value(QStringLiteral("originalSha256")).toString()) {
                fail(QStringLiteral(
                         "Original %1 backup hash does not match the manifest")
                         .arg(path));
            }
            const QByteArray before =
                readAll(resolveSafeSourceFile(appRoot, path));
            const QString expected = currentSourceOptimizations
                ? file.value(QStringLiteral("patchedSha256")).toString()
                : file.value(QStringLiteral("originalSha256")).toString();
            if (sha256(before) != expected) {
                fail(QStringLiteral("%1 changed during source selection update")
                         .arg(path));
            }
            inputs.append({path, original,
                           file.value(QStringLiteral("originalSha256"))
                               .toString()});
            sourceUpdates.append({path, before, original});
        }
        if (sourceOptimizations) {
            const SourcePatchResult patched = applyKnownSourcePatchFiles(inputs);
            if (!patched.applied
                || patched.patch.id
                    != installedSourcePatch.value(QStringLiteral("id")).toString()) {
                fail(QStringLiteral(
                    "Installed source patch is not the active retained transformation"));
            }
            QHash<QString, QByteArray> outputs;
            for (const SourcePatchOutput& output : patched.files) {
                outputs.insert(output.info.path, output.bytes);
            }
            for (SourceUpdate& update : sourceUpdates) {
                if (!outputs.contains(update.path)) {
                    fail(QStringLiteral("Source patch output is missing %1")
                             .arg(update.path));
                }
                update.after = outputs.value(update.path);
            }
        }
    }

    QJsonObject manifest = current.manifest;
    QJsonObject updatedIndex = index;
    updatedIndex.insert(QStringLiteral("patchedSha256"), sha256(patchedIndex));
    manifest.insert(QStringLiteral("index"), updatedIndex);
    if (!installedSourcePatch.isEmpty()) {
        QJsonObject updatedSourcePatch = installedSourcePatch;
        updatedSourcePatch.insert(QStringLiteral("enabled"),
                                  sourceOptimizations);
        manifest.insert(QStringLiteral("sourcePatch"), updatedSourcePatch);
    }
    manifest.insert(
        QStringLiteral("settings"),
        QJsonObject{
            {QStringLiteral("pathfindingMode"), pathfindingMode},
            {QStringLiteral("textureMode"), textureMode},
            {QStringLiteral("sourceOptimizations"), sourceOptimizations},
        });
    const QString pendingPath = resolveSafeManagedFile(
        appRoot, QString::fromLatin1(kPendingPath), false);
    const QString manifestPath = resolveSafeManagedFile(
        appRoot, QString::fromLatin1(kManifestPath), true);
    const QByteArray previousManifest = readAll(manifestPath);
    atomicWriteJson(pendingPath, manifest);
    try {
        for (const SourceUpdate& update : sourceUpdates) {
            atomicWrite(resolveSafeSourceFile(appRoot, update.path),
                        update.after);
        }
        atomicWrite(indexPath, patchedIndex);
        injectTestingFailure(
            QStringLiteral("configuration-before-manifest"));
        atomicWriteJson(manifestPath, manifest);
        if (!QFile::remove(pendingPath)) {
            fail(QStringLiteral("Settings updated, but could not remove the "
                                "pending installation journal: %1")
                     .arg(pendingPath));
        }
    } catch (...) {
        const std::exception_ptr original = std::current_exception();
        try {
            for (const SourceUpdate& update : sourceUpdates) {
                atomicWrite(resolveSafeSourceFile(appRoot, update.path),
                            update.before);
            }
            atomicWrite(indexPath, previousIndex);
            atomicWrite(manifestPath, previousManifest);
            QFile::remove(pendingPath);
        } catch (...) {
            // Keep the journal when rollback itself cannot complete.
        }
        std::rethrow_exception(original);
    }
    return status(appRoot);
}

PatcherStatus Patcher::updatePathfindingMode(
    const QString& selectedPath,
    const QString& pathfindingMode)
{
    return updateConfiguration(selectedPath, pathfindingMode, {});
}

PatcherStatus Patcher::updateTextureMode(const QString& selectedPath,
                                         const QString& textureMode)
{
    return updateConfiguration(selectedPath, {}, textureMode);
}

PatcherStatus Patcher::updateSourceOptimizations(const QString& selectedPath,
                                                 bool enabled)
{
    return updateConfiguration(selectedPath, {}, {}, enabled);
}

PatcherStatus Patcher::uninstall(const QString& selectedPath)
{
    const PatcherStatus current = status(selectedPath);
    if (current.state == PatcherState::NotInstalled) {
        return current;
    }
    if (current.state != PatcherState::Installed || current.manifest.isEmpty()) {
        fail(QStringLiteral(
                 "Refusing uninstall because installed files changed: %1")
                 .arg(current.problems.join("; ")));
    }
    const QString& appRoot = current.inspection.appRoot;
    verifyWritableLayout(appRoot);
    const QJsonObject index =
        current.manifest.value(QStringLiteral("index")).toObject();
    const QString backupPath = resolveSafeManagedFile(
        appRoot, index.value(QStringLiteral("backupPath")).toString(), true);
    const QByteArray backup = readAll(backupPath);
    if (sha256(backup)
        != index.value(QStringLiteral("originalSha256")).toString()) {
        fail(QStringLiteral(
            "Original index.html backup hash does not match the manifest"));
    }
    const QJsonObject sourcePatch =
        current.manifest.value(QStringLiteral("sourcePatch")).toObject();
    struct SourceRestore {
        QString path;
        QByteArray original;
        QByteArray previous;
    };
    QList<SourceRestore> sourceRestores;
    if (!sourcePatch.isEmpty()) {
        for (const QJsonValue& value : sourceFilesFromManifest(sourcePatch)) {
            const QJsonObject file = value.toObject();
            const QString relativePath =
                file.value(QStringLiteral("path")).toString();
            const QByteArray original = readAll(resolveSafeSourceBackup(
                appRoot,
                file.value(QStringLiteral("backupPath")).toString(), true));
            if (sha256(original)
                != file.value(QStringLiteral("originalSha256")).toString()) {
                fail(QStringLiteral(
                         "Original %1 backup hash does not match the manifest")
                         .arg(relativePath));
            }
            const QString target =
                resolveSafeSourceFile(appRoot, relativePath);
            sourceRestores.append(
                {relativePath, original, readAll(target)});
        }
    }
    const QString destination = resolveSafeManagedDirectory(
        appRoot, QString::fromLatin1(kDestinationDirectory), true);
    const QString expected =
        QDir::cleanPath(QDir(appRoot).filePath(kDestinationDirectory));
    if (QDir::cleanPath(destination).compare(expected, pathCaseSensitivity())
        != 0) {
        fail(QStringLiteral("Refusing unexpected removal target"));
    }
    const QJsonObject modBridge =
        current.manifest.value(QStringLiteral("modBridge")).toObject();
    const QString bridgeModPath = modBridge.isEmpty()
        ? QString()
        : resolveSafeBridgeModPath(appRoot, true);
    const QString id =
        current.manifest.value(QStringLiteral("id")).toString();
    const QString historyPath = resolveSafeManagedFile(
        appRoot,
        QStringLiteral("%1/uninstalled/%2/installation.json")
            .arg(kStateDirectory, id),
        false);
    ensureParent(historyPath);
    const QString manifestPath = resolveSafeManagedFile(
        appRoot, QString::fromLatin1(kManifestPath), true);
    const QByteArray previousManifest = readAll(manifestPath);
    const QString indexPath = resolveSafeManagedFile(
        appRoot, index.value(QStringLiteral("path")).toString(), true);
    const QByteArray previousIndex = readAll(indexPath);
    const QString stagingRoot = resolveSafeManagedDirectory(
        appRoot,
        QStringLiteral("%1/uninstall-staging/%2")
            .arg(kStateDirectory, id),
        false);
    const QString stagedPayload = resolveSafeManagedDirectory(
        appRoot,
        QStringLiteral("%1/uninstall-staging/%2/payload")
            .arg(kStateDirectory, id),
        false);
    const QString stagedBridge = resolveSafeManagedFile(
        appRoot,
        QStringLiteral("%1/uninstall-staging/%2/%3")
            .arg(kStateDirectory, id, kBridgeModFileName),
        false);
    if (QFileInfo::exists(historyPath) || QFileInfo::exists(stagingRoot)) {
        fail(QStringLiteral("Uninstall transaction destination already exists"));
    }
    const QString pendingPath = resolveSafeManagedFile(
        appRoot, QString::fromLatin1(kPendingPath), false);
    atomicWriteJson(pendingPath, current.manifest);
    try {
        if (!QDir().mkpath(stagingRoot)) {
            fail(QStringLiteral("Could not create uninstall staging directory"));
        }
        if (!QDir().rename(destination, stagedPayload)) {
            fail(QStringLiteral("Could not stage installed payload"));
        }
        if (!bridgeModPath.isEmpty()
            && !QFile::rename(bridgeModPath, stagedBridge)) {
            fail(QStringLiteral("Could not stage installed bridge mod"));
        }
        for (const SourceRestore& file : sourceRestores) {
            atomicWrite(resolveSafeSourceFile(appRoot, file.path),
                        file.original);
        }
        atomicWrite(indexPath, backup);
        if (!QFile::rename(manifestPath, historyPath)) {
            fail(QStringLiteral("Could not archive installation manifest"));
        }
        if (!QFile::remove(pendingPath)) {
            fail(QStringLiteral("Could not remove uninstall pending journal"));
        }
        QDir(stagingRoot).removeRecursively();
    } catch (...) {
        const std::exception_ptr original = std::current_exception();
        try {
            if (QFileInfo::exists(historyPath)) {
                if (!QFile::rename(historyPath, manifestPath)) {
                    fail(QStringLiteral("Could not restore installation manifest"));
                }
            } else if (!QFileInfo::exists(manifestPath)) {
                atomicWrite(manifestPath, previousManifest);
            }
            for (const SourceRestore& file : sourceRestores) {
                atomicWrite(resolveSafeSourceFile(appRoot, file.path),
                            file.previous);
            }
            atomicWrite(indexPath, previousIndex);
            if (QFileInfo::exists(stagedPayload)) {
                if (!QDir().rename(stagedPayload, destination)) {
                    fail(QStringLiteral("Could not restore staged payload"));
                }
            }
            if (!bridgeModPath.isEmpty()
                && QFileInfo::exists(stagedBridge)) {
                if (!QFile::rename(stagedBridge, bridgeModPath)) {
                    fail(QStringLiteral("Could not restore staged bridge mod"));
                }
            }
            if (QFileInfo::exists(stagingRoot)
                && !QDir(stagingRoot).removeRecursively()) {
                fail(QStringLiteral("Could not remove uninstall staging"));
            }
            if (QFileInfo::exists(pendingPath)
                && !QFile::remove(pendingPath)) {
                fail(QStringLiteral("Could not remove uninstall rollback journal"));
            }
        } catch (...) {
            // Keep the journal when rollback itself cannot complete.
        }
        std::rethrow_exception(original);
    }
    return status(appRoot);
}

QJsonObject Patcher::toJson(const PatcherStatus& value)
{
    QJsonArray problems;
    for (const QString& problem : value.problems) {
        problems.append(problem);
    }
    return {
        {QStringLiteral("state"), stateName(value.state)},
        {QStringLiteral("appRoot"), value.inspection.appRoot},
        {QStringLiteral("bundleSha256"), value.inspection.bundleSha256},
        {QStringLiteral("gameVersion"),
         value.inspection.gameVersion.isEmpty()
             ? QJsonValue(QJsonValue::Null)
             : QJsonValue(value.inspection.gameVersion)},
        {QStringLiteral("knownBundle"), value.inspection.knownBundle},
        {QStringLiteral("sourcePatched"), value.inspection.sourcePatched},
        {QStringLiteral("manifest"),
         value.manifest.isEmpty() ? QJsonValue(QJsonValue::Null)
                                   : QJsonValue(value.manifest)},
        {QStringLiteral("upgradeAvailable"), value.upgradeAvailable},
        {QStringLiteral("problems"), problems},
    };
}

QString Patcher::stateName(PatcherState state)
{
    return ::stateName(state);
}

#ifdef KD_SOURCE_PATCH_TESTING
void Patcher::setFailurePointForTesting(const QString& point)
{
    testingFailurePoint() = point;
}
#endif

} // namespace kd
