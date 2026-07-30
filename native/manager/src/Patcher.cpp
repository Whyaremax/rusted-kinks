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
#include <exception>
namespace {

constexpr auto kKnownGameVersion = "5.4.92";
constexpr auto kKnownPackageVersion = "5.1.12";
constexpr auto kStateDirectory = ".kd-hybrid";
constexpr auto kManifestPath = ".kd-hybrid/installation.json";
constexpr auto kPendingPath = ".kd-hybrid/pending-installation.json";
constexpr auto kDestinationDirectory = "kd-hybrid";
constexpr auto kBootstrapScript = "kd-hybrid/kd-hybrid-bootstrap.js";
constexpr auto kBridgeModFileName = "KDHybridBridge.zip";
constexpr auto kBridgeModRelativePath = "Mods/KDHybridBridge.zip";

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
        const QFileInfo info(resolveInside(appRoot, relative));
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
    verifyWritableDirectory(resolveInside(appRoot, QStringLiteral("out")));
    verifyWritableFile(resolveInside(appRoot, QStringLiteral("index.html")));
    verifyWritableFile(resolveInside(appRoot, QStringLiteral("out/main.js")));
    for (const QString& relative :
         {QString::fromLatin1(kStateDirectory),
          QString::fromLatin1(kDestinationDirectory)}) {
        const QString existing = resolveInside(appRoot, relative);
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
        if (!modsInfo.isDir() || modsInfo.isSymLink()) {
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

QJsonObject validateManifest(const QJsonObject& manifest, const QString& appRoot)
{
    if (manifest.value(QStringLiteral("schema")).toInt() != 1
        || !manifest.value(QStringLiteral("id")).isString()
        || !manifest.value(QStringLiteral("index")).isObject()
        || !manifest.value(QStringLiteral("upstream")).isObject()
        || !manifest.value(QStringLiteral("files")).isArray()) {
        fail(QStringLiteral("Invalid KD Hybrid installation manifest"));
    }
    const QJsonArray files = manifest.value(QStringLiteral("files")).toArray();
    for (const QJsonValue& value : files) {
        if (!value.isObject()
            || !value.toObject().value(QStringLiteral("path")).isString()) {
            fail(QStringLiteral("Invalid file entry in installation manifest"));
        }
        resolveInside(appRoot,
                      value.toObject().value(QStringLiteral("path")).toString());
    }
    const QJsonValue sourcePatchValue =
        manifest.value(QStringLiteral("sourcePatch"));
    if (!sourcePatchValue.isUndefined()) {
        if (!sourcePatchValue.isObject()) {
            fail(QStringLiteral("Invalid source patch in installation manifest"));
        }
        const QJsonObject sourcePatch = sourcePatchValue.toObject();
        if (!sourcePatch.value(QStringLiteral("path")).isString()
            || !sourcePatch.value(QStringLiteral("backupPath")).isString()
            || !sourcePatch.value(QStringLiteral("originalSha256")).isString()
            || !sourcePatch.value(QStringLiteral("patchedSha256")).isString()) {
            fail(QStringLiteral("Invalid source patch in installation manifest"));
        }
        resolveInside(
            appRoot, sourcePatch.value(QStringLiteral("path")).toString());
        resolveInside(
            appRoot, sourcePatch.value(QStringLiteral("backupPath")).toString());
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
            || !modBridge.value(QStringLiteral("bytes")).isDouble()) {
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

void copyPayload(const QString& appRoot, const QStringList& files)
{
    const QString destinationRoot = resolveInside(appRoot, kDestinationDirectory);
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
        const QString destination = resolveInside(
            appRoot, QStringLiteral("%1/%2")
                         .arg(kDestinationDirectory, relativePath));
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
    const QString target = resolveBridgeModPath(appRoot);
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
    const QString bridgeTarget = resolveBridgeModPath(appRoot);
    const QJsonObject currentBridge =
        current.manifest.value(QStringLiteral("modBridge")).toObject();
    if (currentBridge.isEmpty() && QFileInfo::exists(bridgeTarget)) {
        fail(QStringLiteral("Destination already exists: %1")
                 .arg(bridgeTarget));
    }

    const QString manifestPath = resolveInside(appRoot, kManifestPath);
    const QString pendingPath = resolveInside(appRoot, kPendingPath);
    const QByteArray previousManifest = readAll(manifestPath);
    QHash<QString, QByteArray> previousFiles;
    for (const QJsonValue& value :
         current.manifest.value(QStringLiteral("files")).toArray()) {
        const QString relativePath =
            value.toObject().value(QStringLiteral("path")).toString();
        previousFiles.insert(relativePath,
                             readAll(resolveInside(appRoot, relativePath)));
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
            const QString target = resolveInside(
                appRoot, QStringLiteral("%1/%2")
                             .arg(kDestinationDirectory, relativePath));
            atomicWrite(target, bytes);
            if (sha256File(target) != sha256(bytes)) {
                fail(QStringLiteral("Upgraded payload hash mismatch: %1")
                         .arg(relativePath));
            }
        }
        for (auto it = previousFiles.cbegin();
             it != previousFiles.cend(); ++it) {
            if (!desiredPaths.contains(it.key())
                && QFileInfo::exists(resolveInside(appRoot, it.key()))
                && !QFile::remove(resolveInside(appRoot, it.key()))) {
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
                const QString target =
                    resolveInside(appRoot, installedPath);
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
                    atomicWrite(resolveInside(appRoot, it.key()), it.value());
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
    result.bundleSha256 =
        sha256File(resolveInside(result.appRoot, QStringLiteral("out/main.js")));
    result.knownBundle = isKnownSourceBundle(result.bundleSha256);
    result.sourcePatched =
        result.bundleSha256 == sourcePatchOutputSha256();
    if (result.knownBundle) {
        result.gameVersion = QString::fromLatin1(kKnownGameVersion);
        result.packageVersion = QString::fromLatin1(kKnownPackageVersion);
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
    const QString manifestPath = resolveInside(appRoot, kManifestPath);
    const QString pendingPath = resolveInside(appRoot, kPendingPath);
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
    const QString indexPath =
        resolveInside(appRoot, index.value(QStringLiteral("path")).toString());
    if (sha256File(indexPath)
        != index.value(QStringLiteral("patchedSha256")).toString()) {
        result.problems.append(
            QStringLiteral("index.html changed after KD Hybrid installation"));
    }
    for (const QJsonValue& value :
         result.manifest.value(QStringLiteral("files")).toArray()) {
        const QJsonObject file = value.toObject();
        const QString relativePath =
            file.value(QStringLiteral("path")).toString();
        const QString target = resolveInside(appRoot, relativePath);
        if (!QFileInfo::exists(target)) {
            result.problems.append(relativePath + QStringLiteral(" is missing"));
        } else if (sha256File(target)
                   != file.value(QStringLiteral("sha256")).toString()) {
            result.problems.append(relativePath + QStringLiteral(" was modified"));
        }
    }
    const QJsonObject modBridge =
        result.manifest.value(QStringLiteral("modBridge")).toObject();
    if (!modBridge.isEmpty()) {
        const QString relativePath =
            modBridge.value(QStringLiteral("path")).toString();
        const QString target =
            resolveBridgeModPath(appRoot, relativePath);
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
    const QString expectedBundleSha256 =
        sourcePatch.isEmpty()
        ? upstream.value(QStringLiteral("bundleSha256")).toString()
        : sourcePatch.value(QStringLiteral("patchedSha256")).toString();
    if (sha256File(resolveInside(
            appRoot, upstream.value(QStringLiteral("bundlePath")).toString()))
        != expectedBundleSha256) {
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
                               const QString& textureModeInput)
{
    const QString pathfindingMode =
        validatePathfindingMode(pathfindingModeInput);
    const QString textureMode = validateTextureMode(textureModeInput);
    const PatcherStatus current = status(selectedPath);
    if (current.state == PatcherState::Installed) {
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
        resolveBridgeModPath(inspection.appRoot);
    if (QFileInfo::exists(bridgeModPath)) {
        fail(QStringLiteral("Destination already exists: %1")
                 .arg(bridgeModPath));
    }
    const QString bundlePath =
        resolveInside(inspection.appRoot, QStringLiteral("out/main.js"));
    const QByteArray originalBundle = readAll(bundlePath);
    const SourcePatchResult sourcePatch =
        applyKnownSourcePatch(originalBundle, inspection.bundleSha256);
    const QString indexPath =
        resolveInside(inspection.appRoot, QStringLiteral("index.html"));
    const QByteArray originalIndex = readAll(indexPath);
    QString originalText = QString::fromUtf8(originalIndex);
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
    const QString backupPath =
        resolveInside(inspection.appRoot, backupRelative);
    const QString bundleBackupRelative =
        QStringLiteral("%1/backups/%2/out-main.js")
            .arg(kStateDirectory, id);
    writeExclusive(backupPath, originalIndex);
    QJsonObject sourcePatchManifest = sourcePatch.manifest;
    if (sourcePatch.applied) {
        writeExclusive(resolveInside(inspection.appRoot, bundleBackupRelative),
                       originalBundle);
        sourcePatchManifest.insert(QStringLiteral("backupPath"),
                                   portablePath(bundleBackupRelative));
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
         }},
    };
    if (sourcePatch.applied) {
        manifest.insert(QStringLiteral("sourcePatch"), sourcePatchManifest);
    }

    const QString stateRoot = resolveInside(inspection.appRoot, kStateDirectory);
    if (!QDir().mkpath(stateRoot)) {
        fail(QStringLiteral("Could not create patcher state directory"));
    }
    atomicWriteJson(resolveInside(inspection.appRoot, kPendingPath), manifest);
    copyPayload(inspection.appRoot, files);
    copyBridgeMod(inspection.appRoot);
    if (sourcePatch.applied) {
        atomicWrite(bundlePath, sourcePatch.bytes);
    }
    atomicWrite(indexPath, patchedIndex);
    atomicWriteJson(resolveInside(inspection.appRoot, kManifestPath), manifest);
    const QString pendingPath =
        resolveInside(inspection.appRoot, kPendingPath);
    if (!QFile::remove(pendingPath)) {
        fail(QStringLiteral("Installed successfully, but could not remove "
                            "the pending installation journal: %1")
                 .arg(pendingPath));
    }
    return status(inspection.appRoot);
}

PatcherStatus Patcher::updateConfiguration(
    const QString& selectedPath,
    const QString& pathfindingModeInput,
    const QString& textureModeInput)
{
    const PatcherStatus current = status(selectedPath);
    if (current.state != PatcherState::Installed
        || current.manifest.isEmpty()) {
        fail(QStringLiteral(
                 "Refusing settings update over %1 patcher state: %2")
                 .arg(stateName(current.state),
                      current.problems.join(QStringLiteral("; "))));
    }
    const QString& appRoot = current.inspection.appRoot;
    verifyWritableLayout(appRoot);
    const QJsonObject index =
        current.manifest.value(QStringLiteral("index")).toObject();
    const QString indexPath =
        resolveInside(appRoot, index.value(QStringLiteral("path")).toString());
    QString text = QString::fromUtf8(readAll(indexPath));
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

    QJsonObject manifest = current.manifest;
    QJsonObject updatedIndex = index;
    updatedIndex.insert(QStringLiteral("patchedSha256"), sha256(patchedIndex));
    manifest.insert(QStringLiteral("index"), updatedIndex);
    manifest.insert(
        QStringLiteral("settings"),
        QJsonObject{
            {QStringLiteral("pathfindingMode"), pathfindingMode},
            {QStringLiteral("textureMode"), textureMode},
        });
    atomicWriteJson(resolveInside(appRoot, kPendingPath), manifest);
    atomicWrite(indexPath, patchedIndex);
    atomicWriteJson(resolveInside(appRoot, kManifestPath), manifest);
    const QString pendingPath = resolveInside(appRoot, kPendingPath);
    if (!QFile::remove(pendingPath)) {
        fail(QStringLiteral("Settings updated, but could not remove the "
                            "pending installation journal: %1")
                 .arg(pendingPath));
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
    const QString backupPath =
        resolveInside(appRoot,
                      index.value(QStringLiteral("backupPath")).toString());
    const QByteArray backup = readAll(backupPath);
    if (sha256(backup)
        != index.value(QStringLiteral("originalSha256")).toString()) {
        fail(QStringLiteral(
            "Original index.html backup hash does not match the manifest"));
    }
    const QJsonObject sourcePatch =
        current.manifest.value(QStringLiteral("sourcePatch")).toObject();
    QByteArray originalBundle;
    if (!sourcePatch.isEmpty()) {
        originalBundle = readAll(resolveInside(
            appRoot, sourcePatch.value(QStringLiteral("backupPath")).toString()));
        if (sha256(originalBundle)
            != sourcePatch.value(QStringLiteral("originalSha256")).toString()) {
            fail(QStringLiteral(
                "Original out/main.js backup hash does not match the manifest"));
        }
    }
    if (!sourcePatch.isEmpty()) {
        atomicWrite(
            resolveInside(
                appRoot, sourcePatch.value(QStringLiteral("path")).toString()),
            originalBundle);
    }
    atomicWrite(resolveInside(
                    appRoot, index.value(QStringLiteral("path")).toString()),
                backup);

    const QString destination =
        resolveInside(appRoot, kDestinationDirectory);
    const QString expected =
        QDir::cleanPath(QDir(appRoot).filePath(kDestinationDirectory));
    if (QDir::cleanPath(destination).compare(expected, pathCaseSensitivity())
        != 0) {
        fail(QStringLiteral("Refusing unexpected removal target"));
    }
    if (QFileInfo::exists(destination)
        && !QDir(destination).removeRecursively()) {
        fail(QStringLiteral("Could not remove installed payload: %1")
                 .arg(destination));
    }
    const QJsonObject modBridge =
        current.manifest.value(QStringLiteral("modBridge")).toObject();
    if (!modBridge.isEmpty()) {
        const QString bridgeModPath = resolveBridgeModPath(
            appRoot, modBridge.value(QStringLiteral("path")).toString());
        if (QFileInfo::exists(bridgeModPath)
            && !QFile::remove(bridgeModPath)) {
            fail(QStringLiteral("Could not remove installed bridge mod: %1")
                     .arg(bridgeModPath));
        }
    }

    const QString id =
        current.manifest.value(QStringLiteral("id")).toString();
    const QString historyPath = resolveInside(
        appRoot,
        QStringLiteral("%1/uninstalled/%2/installation.json")
            .arg(kStateDirectory, id));
    ensureParent(historyPath);
    const QString manifestPath = resolveInside(appRoot, kManifestPath);
    if (!QFile::rename(manifestPath, historyPath)) {
        fail(QStringLiteral("Could not archive installation manifest"));
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

} // namespace kd
