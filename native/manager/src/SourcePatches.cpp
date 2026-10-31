// SPDX-License-Identifier: MPL-2.0
//
// Exact, version-gated transformations adapted from supported Kinky Dungeon releases.
// Kinky Dungeon is Copyright Strait Laced Games LLC.

#include "SourcePatches.h"

#include <QCryptographicHash>
#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QRegularExpression>
#include <QSet>

#include <iterator>
#include <stdexcept>

namespace {

struct RawSourcePatchFileDefinition {
    const char* path;
    const char* inputSha256;
    const char* outputSha256;
    const char* patchResource;
};

struct RawSourcePatchDefinition {
    const char* id;
    const char* upstreamVersion;
    const char* packageVersion;
    const char* sourceUrl;
    const RawSourcePatchFileDefinition* files;
    std::size_t fileCount;
    bool legacy;
};

constexpr RawSourcePatchFileDefinition kV6Files[] = {
    {
        "out/main.js",
        "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4",
        "aa4c09e73de34b1ab6eea5328880049578963c7c3dcbaae07728ca408da59f92",
        ":/bootstrap/source/MPL-2.0/upstream-patches/kd-5.4.92/"
        "bundle-optimizations-v6.patch",
    },
};

constexpr RawSourcePatchFileDefinition kV7Files[] = {
    {
        "out/main.js",
        "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4",
        "aa92bb52a07a553086525704f3b1ee8f3a7f2fe6e008cd507f74c9cde9c57b3d",
        ":/bootstrap/source/MPL-2.0/upstream-patches/kd-5.4.92/"
        "bundle-optimizations-v7.patch",
    },
    {
        "Scripts/lib/pixi-filters.js",
        "23aa3d8d53e0755bf39bf6d7d2b409788b502a46f35cde53564ed7230af7a507",
        "4cfc4145e5950a17df19642fcc6cc378b2b3abef4276e7f56e39628739ae6b95",
        ":/bootstrap/source/MIT/upstream-patches/pixi-filters-5.2.0/"
        "compatibility-v1.patch",
    },
};

constexpr RawSourcePatchFileDefinition kV55V1Files[] = {
    {
        "out/main.js",
        "60a85515783853653fd051936429494b8ef85024ff66b08134e68f9fe89248e0",
        "2a42cf93ea4d084988afdd37d5bd96c0f9fe4f7ef6b662b2ed1f8776a7443234",
        ":/bootstrap/source/MPL-2.0/upstream-patches/kd-5.5.1/"
        "bundle-optimizations-v1.patch",
    },
    {
        "Scripts/lib/pixi-filters.js",
        "23aa3d8d53e0755bf39bf6d7d2b409788b502a46f35cde53564ed7230af7a507",
        "4cfc4145e5950a17df19642fcc6cc378b2b3abef4276e7f56e39628739ae6b95",
        ":/bootstrap/source/MIT/upstream-patches/pixi-filters-5.2.0/"
        "compatibility-v1.patch",
    },
};

constexpr RawSourcePatchFileDefinition kV556V1Files[] = {
 {"out/main.js", "e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25", "8751afa2b64d82a446d279d512d30eb0b8d7a0cb642c7dfc779f6bf4edaa779c", ":/bootstrap/source/MPL-2.0/upstream-patches/kd-5.5.6/bundle-optimizations-v1.patch"},
 {"Scripts/lib/pixi-filters.js", "23aa3d8d53e0755bf39bf6d7d2b409788b502a46f35cde53564ed7230af7a507", "4cfc4145e5950a17df19642fcc6cc378b2b3abef4276e7f56e39628739ae6b95", ":/bootstrap/source/MIT/upstream-patches/pixi-filters-5.2.0/compatibility-v1.patch"},
};

constexpr RawSourcePatchFileDefinition kV556V2Files[] = {
 {"out/main.js", "e829844f4513baa83f6bb301c77ac37425f96c75d428fdf3065c6a06c90bff25", "4303a9a102d7596e8c4a62793d6e76c3003c8e2abbea185c642c260a0e07c00b", ":/bootstrap/source/MPL-2.0/upstream-patches/kd-5.5.6/bundle-optimizations-v2.patch"},
 {"Scripts/lib/pixi-filters.js", "23aa3d8d53e0755bf39bf6d7d2b409788b502a46f35cde53564ed7230af7a507", "4cfc4145e5950a17df19642fcc6cc378b2b3abef4276e7f56e39628739ae6b95", ":/bootstrap/source/MIT/upstream-patches/pixi-filters-5.2.0/compatibility-v1.patch"},
};

constexpr RawSourcePatchDefinition kSourcePatches[] = {
 {"kd-5.5.6-source-optimizations-v2", "5.5.6", "5.1.12", "https://ada18980.itch.io/kinky-dungeon/devlog/1740880/556-official", kV556V2Files, std::size(kV556V2Files), false},
 {"kd-5.5.6-source-optimizations-v1", "5.5.6", "5.1.12", "https://ada18980.itch.io/kinky-dungeon/devlog/1740880/556-official", kV556V1Files, std::size(kV556V1Files), true},
    {
        "kd-5.4.92-source-optimizations-v6",
        "5.4.92",
        "5.1.12",
        "https://github.com/Ada18980/KinkiestDungeon/tree/"
        "5c96c4c1e67faf136ba2c167ed889a9e29005a18",
        kV6Files,
        std::size(kV6Files),
        true,
    },
    {
        "kd-5.4.92-source-optimizations-v7",
        "5.4.92",
        "5.1.12",
        "https://github.com/Ada18980/KinkiestDungeon/tree/"
        "5c96c4c1e67faf136ba2c167ed889a9e29005a18",
        kV7Files,
        std::size(kV7Files),
        false,
    },
    {
        "kd-5.5.1-source-optimizations-v1",
        "5.5.1",
        "5.1.12",
        "https://github.com/Ada18980/KinkiestDungeon/tree/"
        "b37a3e91c5481310537dbfe6baa0302a2dcebbc6",
        kV55V1Files,
        std::size(kV55V1Files),
        false,
    },
};

QString sha256(const QByteArray& bytes)
{
    return QString::fromLatin1(
        QCryptographicHash::hash(bytes, QCryptographicHash::Sha256).toHex());
}

[[noreturn]] void failPatch(const QString& patchId,
                            const QString& detail)
{
    throw std::runtime_error(
        QStringLiteral("Source patch %1 %2")
            .arg(patchId, detail)
            .toStdString());
}

QByteArray readPatch(const RawSourcePatchDefinition& patch,
                     const RawSourcePatchFileDefinition& fileDefinition)
{
    QFile file(QString::fromLatin1(fileDefinition.patchResource));
    if (!file.open(QIODevice::ReadOnly)) {
        failPatch(QString::fromLatin1(patch.id),
                  QStringLiteral("resource is unavailable"));
    }
    return file.readAll();
}

QByteArray applyUnifiedPatch(const QByteArray& bundle,
                             const QByteArray& patchBytes,
                             const QString& patchId)
{
    struct SourceLine {
        QByteArray content;
        QByteArray ending;
    };
    const qsizetype crlfCount = bundle.count("\r\n");
    const qsizetype lfCount = bundle.count('\n');
    const QByteArray addedLineEnding =
        crlfCount > lfCount - crlfCount ? QByteArray("\r\n")
                                       : QByteArray("\n");
    QList<SourceLine> sourceLines;
    qsizetype start = 0;
    while (start < bundle.size()) {
        const qsizetype newline = bundle.indexOf('\n', start);
        if (newline < 0) {
            sourceLines.append({bundle.sliced(start), {}});
            break;
        }
        const bool crlf = newline > start && bundle[newline - 1] == '\r';
        sourceLines.append({
            bundle.sliced(start, newline - start - (crlf ? 1 : 0)),
            crlf ? QByteArray("\r\n") : QByteArray("\n"),
        });
        start = newline + 1;
    }

    QByteArray normalizedPatch = patchBytes;
    normalizedPatch.replace("\r\n", "\n");
    const QList<QByteArray> patchLines = normalizedPatch.split('\n');
    QList<SourceLine> output;
    qsizetype sourceIndex = 0;
    qsizetype patchIndex = 0;
    while (patchIndex < patchLines.size()
           && !patchLines[patchIndex].startsWith("@@ ")) {
        ++patchIndex;
    }
    if (patchIndex >= patchLines.size()) {
        failPatch(patchId, QStringLiteral("contains no unified diff hunks"));
    }

    static const QRegularExpression hunkPattern(
        QStringLiteral(
            R"(^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@)"));
    while (patchIndex < patchLines.size()) {
        const QByteArray& header = patchLines[patchIndex];
        if (!header.startsWith("@@ ")) {
            ++patchIndex;
            continue;
        }
        const QRegularExpressionMatch match =
            hunkPattern.match(QString::fromUtf8(header));
        if (!match.hasMatch()) {
            failPatch(patchId, QStringLiteral("has an invalid hunk header"));
        }
        const qsizetype oldStart = match.captured(1).toLongLong();
        const qsizetype oldCount =
            match.captured(2).isEmpty() ? 1 : match.captured(2).toLongLong();
        const qsizetype newCount =
            match.captured(4).isEmpty() ? 1 : match.captured(4).toLongLong();
        const qsizetype targetIndex = qMax<qsizetype>(0, oldStart - 1);
        if (targetIndex < sourceIndex || targetIndex > sourceLines.size()) {
            failPatch(patchId,
                      QStringLiteral("hunk starts outside the source bundle"));
        }
        while (sourceIndex < targetIndex) {
            output.append(sourceLines[sourceIndex]);
            ++sourceIndex;
        }

        ++patchIndex;
        qsizetype consumedOld = 0;
        qsizetype producedNew = 0;
        while (patchIndex < patchLines.size()) {
            const QByteArray& line = patchLines[patchIndex];
            if (line.startsWith("@@ ") || line.startsWith("diff --git ")) {
                break;
            }
            if (line.startsWith('\\')) {
                ++patchIndex;
                continue;
            }
            if (line.isEmpty()) {
                ++patchIndex;
                continue;
            }
            const char operation = line.front();
            const QByteArray content = line.sliced(1);
            if (operation == ' ' || operation == '-') {
                if (sourceIndex >= sourceLines.size()
                    || sourceLines[sourceIndex].content != content) {
                    failPatch(
                        patchId,
                        QStringLiteral("hunk did not match source line %1")
                            .arg(sourceIndex + 1));
                }
                ++sourceIndex;
                ++consumedOld;
                if (operation == ' ') {
                    output.append(sourceLines[sourceIndex - 1]);
                    ++producedNew;
                }
            } else if (operation == '+') {
                output.append({content, addedLineEnding});
                ++producedNew;
            } else {
                failPatch(patchId,
                          QStringLiteral("contains an invalid hunk line"));
            }
            ++patchIndex;
        }
        if (consumedOld != oldCount || producedNew != newCount) {
            failPatch(
                patchId,
                QStringLiteral("hunk line counts did not match its header"));
        }
    }

    while (sourceIndex < sourceLines.size()) {
        output.append(sourceLines[sourceIndex]);
        ++sourceIndex;
    }
    QByteArray result;
    for (const SourceLine& line : output) {
        result.append(line.content);
        result.append(line.ending);
    }
    return result;
}

bool safePatchPath(const QString& path)
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

QString hashKey(const QString& path, const QString& hash)
{
    return path + QChar::Null + hash;
}

QList<kd::SourcePatchDefinition> productionDefinitions()
{
    QList<kd::SourcePatchDefinition> result;
    result.reserve(static_cast<qsizetype>(std::size(kSourcePatches)));
    for (const RawSourcePatchDefinition& raw : kSourcePatches) {
        QList<kd::SourcePatchFileDefinition> files;
        files.reserve(static_cast<qsizetype>(raw.fileCount));
        for (std::size_t index = 0; index < raw.fileCount; ++index) {
            const RawSourcePatchFileDefinition& sourceFile = raw.files[index];
            kd::SourcePatchFileInfo file{
                QString::fromLatin1(sourceFile.path),
                QString::fromLatin1(sourceFile.inputSha256),
                QString::fromLatin1(sourceFile.outputSha256),
            };
            files.append({file, readPatch(raw, sourceFile)});
        }
        if (files.isEmpty()) {
            throw std::logic_error("Production source patch has no files");
        }
        const kd::SourcePatchFileInfo& primary = files.first().info;
        kd::SourcePatchInfo info{
            QString::fromLatin1(raw.id),
            QString::fromLatin1(raw.upstreamVersion),
            QString::fromLatin1(raw.packageVersion),
            primary.inputSha256,
            primary.outputSha256,
            QString::fromLatin1(raw.sourceUrl),
            {},
            raw.legacy,
        };
        result.append({info, files});
    }
    return result;
}

const kd::SourcePatchCatalog*& testingCatalogOverride()
{
    static const kd::SourcePatchCatalog* catalog = nullptr;
    return catalog;
}

const kd::SourcePatchCatalog& knownCatalog()
{
    if (testingCatalogOverride() != nullptr) {
        return *testingCatalogOverride();
    }
    static const kd::SourcePatchCatalog catalog(productionDefinitions());
    return catalog;
}

} // namespace

namespace kd {

SourcePatchCatalog::SourcePatchCatalog(QList<SourcePatchDefinition> definitions)
    : definitions_(std::move(definitions))
{
    const QRegularExpression hashPattern(QStringLiteral("^[0-9a-f]{64}$"));
    QSet<QString> ids;
    QSet<QString> activePrimaryInputs;
    QSet<QString> primaryInputs;
    QSet<QString> primaryOutputs;
    QHash<QString, QByteArray> auxiliaryTransforms;
    for (SourcePatchDefinition& definition : definitions_) {
        SourcePatchInfo& info = definition.info;
        if (info.id.isEmpty() || info.id.trimmed() != info.id
            || info.upstreamVersion.trimmed().isEmpty()
            || info.packageVersion.trimmed().isEmpty()
            || info.sourceUrl.trimmed().isEmpty() || ids.contains(info.id)
            || definition.files.isEmpty()) {
            throw std::logic_error(
                QStringLiteral("Invalid source patch catalog entry: %1")
                    .arg(info.id).toStdString());
        }
        ids.insert(info.id);
        QSet<QString> paths;
        for (qsizetype index = 0; index < definition.files.size(); ++index) {
            SourcePatchFileDefinition& file = definition.files[index];
            file.unifiedPatch.replace("\r\n", "\n");
            file.info.inputSha256 = file.info.inputSha256.toLower();
            file.info.outputSha256 = file.info.outputSha256.toLower();
            const QByteArray expectedHeader =
                QByteArray("diff --git a/") + file.info.path.toUtf8()
                + QByteArray(" b/") + file.info.path.toUtf8() + '\n';
            if (!safePatchPath(file.info.path) || paths.contains(file.info.path)
                || !hashPattern.match(file.info.inputSha256).hasMatch()
                || !hashPattern.match(file.info.outputSha256).hasMatch()
                || file.info.inputSha256 == file.info.outputSha256
                || !file.unifiedPatch.startsWith(expectedHeader)
                || file.unifiedPatch.count("diff --git ") != 1) {
                throw std::logic_error(
                    QStringLiteral("Invalid source patch file in %1: %2")
                        .arg(info.id, file.info.path).toStdString());
            }
            paths.insert(file.info.path);
            if (index == 0) {
                if (file.info.path != QLatin1String("out/main.js")
                    || (!info.legacy
                        && activePrimaryInputs.contains(file.info.inputSha256))
                    || primaryOutputs.contains(file.info.outputSha256)
                    || primaryInputs.contains(file.info.outputSha256)
                    || primaryOutputs.contains(file.info.inputSha256)) {
                    throw std::logic_error(
                        QStringLiteral("Ambiguous source patch selector: %1")
                            .arg(info.id).toStdString());
                }
                primaryInputs.insert(file.info.inputSha256);
                primaryOutputs.insert(file.info.outputSha256);
                if (!info.legacy) {
                    activePrimaryInputs.insert(file.info.inputSha256);
                }
            } else {
                const QString key = hashKey(file.info.path,
                                            file.info.inputSha256);
                const QByteArray signature =
                    file.info.outputSha256.toUtf8() + QByteArray(1, '\0')
                    + file.unifiedPatch;
                if (auxiliaryTransforms.contains(key)
                    && auxiliaryTransforms.value(key) != signature) {
                    throw std::logic_error(
                        QStringLiteral("Conflicting auxiliary source patch: %1")
                            .arg(file.info.path).toStdString());
                }
                auxiliaryTransforms.insert(key, signature);
            }
        }
        const SourcePatchFileInfo& primary = definition.files.first().info;
        info.inputSha256 = primary.inputSha256;
        info.outputSha256 = primary.outputSha256;
        info.files.clear();
        for (const SourcePatchFileDefinition& file : definition.files) {
            info.files.append(file.info);
        }
    }
}

QList<SourcePatchInfo> SourcePatchCatalog::entries() const
{
    QList<SourcePatchInfo> result;
    result.reserve(definitions_.size());
    for (const SourcePatchDefinition& definition : definitions_) {
        result.append(definition.info);
    }
    return result;
}

std::optional<SourcePatchInfo>
SourcePatchCatalog::findActive(const QString& primaryInputSha256) const
{
    for (const SourcePatchDefinition& definition : definitions_) {
        if (!definition.info.legacy
            && definition.info.inputSha256.compare(primaryInputSha256,
                                                    Qt::CaseInsensitive) == 0) {
            return definition.info;
        }
    }
    return std::nullopt;
}

std::optional<SourcePatchInfo>
SourcePatchCatalog::findById(const QString& id) const
{
    for (const SourcePatchDefinition& definition : definitions_) {
        if (definition.info.id == id) {
            return definition.info;
        }
    }
    return std::nullopt;
}

std::optional<SourceBundleMatch>
SourcePatchCatalog::recognizePrimary(const QString& hash) const
{
    if (const std::optional<SourcePatchInfo> active = findActive(hash);
        active.has_value()) {
        return SourceBundleMatch{*active, false};
    }
    for (const SourcePatchDefinition& definition : definitions_) {
        if (definition.info.outputSha256.compare(hash, Qt::CaseInsensitive)
            == 0) {
            return SourceBundleMatch{definition.info, true};
        }
    }
    return std::nullopt;
}

SourcePatchResult
SourcePatchCatalog::apply(const QList<SourcePatchInput>& inputs) const
{
    QHash<QString, SourcePatchInput> byPath;
    for (SourcePatchInput input : inputs) {
        if (!safePatchPath(input.path) || byPath.contains(input.path)) {
            throw std::runtime_error("Unsafe or duplicate source patch input");
        }
        input.sha256 = input.sha256.toLower();
        byPath.insert(input.path, std::move(input));
    }
    if (!byPath.contains(QStringLiteral("out/main.js"))) {
        throw std::runtime_error("Source patch input is missing out/main.js");
    }
    const std::optional<SourcePatchInfo> selected =
        findActive(byPath.value(QStringLiteral("out/main.js")).sha256);
    if (!selected.has_value()) {
        return {};
    }
    const auto definitionIt = std::find_if(
        definitions_.cbegin(), definitions_.cend(), [&](const auto& value) {
            return value.info.id == selected->id;
        });
    if (definitionIt == definitions_.cend()
        || byPath.size() != definitionIt->files.size()) {
        throw std::runtime_error("Source patch input file set is incomplete");
    }
    SourcePatchResult result;
    result.applied = true;
    result.patch = definitionIt->info;
    QJsonArray manifestFiles;
    for (const SourcePatchFileDefinition& file : definitionIt->files) {
        const SourcePatchInput input = byPath.value(file.info.path);
        if (input.path.isEmpty()
            || input.sha256.compare(file.info.inputSha256,
                                    Qt::CaseInsensitive) != 0
            || sha256(input.bytes) != file.info.inputSha256) {
            failPatch(definitionIt->info.id,
                      QStringLiteral("input hash mismatch for %1")
                          .arg(file.info.path));
        }
        const QByteArray output = applyUnifiedPatch(
            input.bytes, file.unifiedPatch,
            definitionIt->info.id + QLatin1Char(':') + file.info.path);
        if (sha256(output) != file.info.outputSha256) {
            failPatch(definitionIt->info.id,
                      QStringLiteral("produced an unexpected hash for %1")
                          .arg(file.info.path));
        }
        result.files.append({file.info, output});
        manifestFiles.append(QJsonObject{
            {QStringLiteral("path"), file.info.path},
            {QStringLiteral("originalSha256"), file.info.inputSha256},
            {QStringLiteral("patchedSha256"), file.info.outputSha256},
        });
        if (file.info.path == QLatin1String("out/main.js")) {
            result.bytes = output;
        }
    }
    const SourcePatchFileInfo primary = definitionIt->files.first().info;
    result.manifest = QJsonObject{
        {QStringLiteral("id"), definitionIt->info.id},
        {QStringLiteral("path"), primary.path},
        {QStringLiteral("originalSha256"), primary.inputSha256},
        {QStringLiteral("patchedSha256"), primary.outputSha256},
        {QStringLiteral("upstreamVersion"),
         definitionIt->info.upstreamVersion},
        {QStringLiteral("sourceUrl"), definitionIt->info.sourceUrl},
    };
    if (result.files.size() > 1) {
        result.manifest.insert(QStringLiteral("files"), manifestFiles);
    }
    return result;
}

QList<SourcePatchInfo> sourcePatchCatalog()
{
    return knownCatalog().entries();
}

std::optional<SourceBundleMatch> findKnownSourceBundle(const QString& sha256)
{
    return knownCatalog().recognizePrimary(sha256);
}

bool isKnownSourceBundle(const QString& value)
{
    return findKnownSourceBundle(value).has_value();
}

bool isKnownPatchedSourceBundle(const QString& value)
{
    const std::optional<SourceBundleMatch> match = findKnownSourceBundle(value);
    return match.has_value() && match->sourcePatched;
}

SourcePatchResult applyKnownSourcePatch(const QByteArray& bundle,
                                        const QString& inputSha256)
{
    return knownCatalog().apply({SourcePatchInput{
        QStringLiteral("out/main.js"), bundle, inputSha256}});
}

SourcePatchResult
applyKnownSourcePatchFiles(const QList<SourcePatchInput>& inputs)
{
    return knownCatalog().apply(inputs);
}

std::optional<SourcePatchInfo> findKnownSourcePatchById(const QString& id)
{
    return knownCatalog().findById(id);
}

#ifdef KD_SOURCE_PATCH_TESTING
void setSourcePatchCatalogForTesting(const SourcePatchCatalog* catalog)
{
    testingCatalogOverride() = catalog;
}
#endif

} // namespace kd
