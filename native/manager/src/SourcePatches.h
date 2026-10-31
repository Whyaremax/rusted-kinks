// SPDX-License-Identifier: MPL-2.0
#pragma once

#include <QByteArray>
#include <QJsonObject>
#include <QList>
#include <QString>

#include <optional>

namespace kd {

struct SourcePatchFileInfo {
    QString path;
    QString inputSha256;
    QString outputSha256;
};

struct SourcePatchInfo {
    QString id;
    QString upstreamVersion;
    QString packageVersion;
    QString inputSha256;
    QString outputSha256;
    QString sourceUrl;
    QList<SourcePatchFileInfo> files;
    bool legacy = false;
};

struct SourcePatchFileDefinition {
    SourcePatchFileInfo info;
    QByteArray unifiedPatch;
};

struct SourcePatchDefinition {
    SourcePatchInfo info;
    QList<SourcePatchFileDefinition> files;
};

struct SourcePatchInput {
    QString path;
    QByteArray bytes;
    QString sha256;
};

struct SourcePatchOutput {
    SourcePatchFileInfo info;
    QByteArray bytes;
};

struct SourceBundleMatch {
    SourcePatchInfo patch;
    bool sourcePatched = false;
};

struct SourcePatchResult {
    bool applied = false;
    QByteArray bytes;
    QJsonObject manifest;
    SourcePatchInfo patch;
    QList<SourcePatchOutput> files;
};

class SourcePatchCatalog final {
public:
    explicit SourcePatchCatalog(QList<SourcePatchDefinition> definitions);

    [[nodiscard]] QList<SourcePatchInfo> entries() const;
    [[nodiscard]] std::optional<SourcePatchInfo>
    findActive(const QString& primaryInputSha256) const;
    [[nodiscard]] std::optional<SourcePatchInfo> findById(const QString& id) const;
    [[nodiscard]] std::optional<SourceBundleMatch>
    recognizePrimary(const QString& sha256) const;
    [[nodiscard]] SourcePatchResult
    apply(const QList<SourcePatchInput>& inputs) const;

private:
    QList<SourcePatchDefinition> definitions_;
};

QList<SourcePatchInfo> sourcePatchCatalog();
std::optional<SourceBundleMatch> findKnownSourceBundle(const QString& sha256);
bool isKnownSourceBundle(const QString& sha256);
bool isKnownPatchedSourceBundle(const QString& sha256);
SourcePatchResult applyKnownSourcePatch(const QByteArray& bundle,
                                        const QString& inputSha256);
SourcePatchResult
applyKnownSourcePatchFiles(const QList<SourcePatchInput>& inputs);
std::optional<SourcePatchInfo> findKnownSourcePatchById(const QString& id);
#ifdef KD_SOURCE_PATCH_TESTING
void setSourcePatchCatalogForTesting(const SourcePatchCatalog* catalog);
#endif

} // namespace kd
