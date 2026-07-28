#include "Patcher.h"
#include "SourcePatches.h"

#include <QCryptographicHash>
#include <QDateTime>
#include <QDir>
#include <QDirIterator>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QRegularExpression>
#include <QSaveFile>
#include <QUuid>

#include <algorithm>
#include <stdexcept>

namespace {

constexpr auto kKnownGameVersion = "5.4.92";
constexpr auto kKnownPackageVersion = "5.1.12";
constexpr auto kStateDirectory = ".kd-hybrid";
constexpr auto kManifestPath = ".kd-hybrid/installation.json";
constexpr auto kPendingPath = ".kd-hybrid/pending-installation.json";
constexpr auto kDestinationDirectory = "kd-hybrid";
constexpr auto kBootstrapScript = "kd-hybrid/kd-hybrid-bootstrap.js";

[[noreturn]] void fail(const QString& message)
{
    throw std::runtime_error(message.toStdString());
}

QString validatePathfindingMode(const QString& mode)
{
    if (mode != QLatin1String("quality") && mode != QLatin1String("fast")
        && mode != QLatin1String("human")) {
        fail(QStringLiteral("Unknown pathfinding mode: %1").arg(mode));
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

QByteArray readAll(const QString& path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        fail(QStringLiteral("Could not read %1: %2").arg(path, file.errorString()));
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
        fail(QStringLiteral("Could not hash %1: %2").arg(path, file.errorString()));
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
        fail(QStringLiteral("Could not open %1: %2").arg(path, file.errorString()));
    }
    if (file.write(bytes) != bytes.size()) {
        file.cancelWriting();
        fail(QStringLiteral("Short write while updating %1").arg(path));
    }
    if (!file.commit()) {
        fail(QStringLiteral("Could not atomically update %1: %2")
                 .arg(path, file.errorString()));
    }
}

void writeExclusive(const QString& path, const QByteArray& bytes)
{
    ensureParent(path);
    QFile file(path);
    if (!file.open(QIODevice::WriteOnly | QIODevice::NewOnly)) {
        fail(QStringLiteral("Refusing to overwrite backup %1: %2")
                 .arg(path, file.errorString()));
    }
    if (file.write(bytes) != bytes.size() || !file.flush()) {
        fail(QStringLiteral("Could not write backup %1").arg(path));
    }
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
    result.state = result.problems.isEmpty() ? PatcherState::Installed
                                             : PatcherState::Modified;
    return result;
}

PatcherStatus Patcher::install(const QString& selectedPath,
                               bool allowUnknownBundle,
                               const QString& pathfindingModeInput)
{
    const QString pathfindingMode =
        validatePathfindingMode(pathfindingModeInput);
    const PatcherStatus current = status(selectedPath);
    if (current.state == PatcherState::Installed) {
        return current;
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

    const QStringList files = payloadFiles();
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

    const QJsonObject config{
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
        {QStringLiteral("settings"),
         QJsonObject{
             {QStringLiteral("pathfindingMode"), pathfindingMode},
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
    if (sourcePatch.applied) {
        atomicWrite(bundlePath, sourcePatch.bytes);
    }
    atomicWrite(indexPath, patchedIndex);
    atomicWriteJson(resolveInside(inspection.appRoot, kManifestPath), manifest);
    QFile::remove(resolveInside(inspection.appRoot, kPendingPath));
    return status(inspection.appRoot);
}

PatcherStatus Patcher::updatePathfindingMode(
    const QString& selectedPath,
    const QString& pathfindingModeInput)
{
    const QString pathfindingMode =
        validatePathfindingMode(pathfindingModeInput);
    const PatcherStatus current = status(selectedPath);
    if (current.state != PatcherState::Installed
        || current.manifest.isEmpty()) {
        fail(QStringLiteral(
                 "Refusing settings update over %1 patcher state: %2")
                 .arg(stateName(current.state),
                      current.problems.join(QStringLiteral("; "))));
    }
    const QString& appRoot = current.inspection.appRoot;
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
    config.insert(QStringLiteral("pathfindingMode"), pathfindingMode);
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
        });
    atomicWriteJson(resolveInside(appRoot, kPendingPath), manifest);
    atomicWrite(indexPath, patchedIndex);
    atomicWriteJson(resolveInside(appRoot, kManifestPath), manifest);
    QFile::remove(resolveInside(appRoot, kPendingPath));
    return status(appRoot);
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
        {QStringLiteral("problems"), problems},
    };
}

QString Patcher::stateName(PatcherState state)
{
    return ::stateName(state);
}

} // namespace kd
