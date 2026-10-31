#pragma once

#include <QByteArray>
#include <QJsonObject>
#include <QString>
#include <QStringList>

#include <optional>
#include <stdexcept>

namespace kd {

enum class PatcherErrorCode {
    General,
    PermissionDenied,
};

class PatcherError final : public std::runtime_error {
public:
    PatcherError(PatcherErrorCode code, const QString& message);
    [[nodiscard]] PatcherErrorCode code() const noexcept;

private:
    PatcherErrorCode code_;
};

enum class PatcherState {
    NotInstalled,
    Installed,
    Modified,
    Incomplete,
};

struct Inspection {
    QString appRoot;
    QString bundleSha256;
    QString gameVersion;
    QString packageVersion;
    bool knownBundle = false;
    bool sourcePatched = false;
};

struct PatcherStatus {
    PatcherState state = PatcherState::NotInstalled;
    Inspection inspection;
    QJsonObject manifest;
    QStringList problems;
    bool upgradeAvailable = false;
};

struct KnownBundleMetadata {
    QString gameVersion;
    QString packageVersion;
    QString bundleSha256;
};

std::optional<KnownBundleMetadata>
findKnownBundleMetadata(const QString& bundleSha256);

QByteArray ensureModernMobileMeta(const QByteArray& indexBytes,
                                  bool knownBuild);

class Patcher final {
public:
    static QString normalizeAppRoot(const QString& selectedPath);
    static Inspection inspect(const QString& selectedPath);
    static PatcherStatus status(const QString& selectedPath);
    static PatcherStatus install(const QString& selectedPath,
                                 bool allowUnknownBundle = false,
                                 const QString& pathfindingMode =
                                     QStringLiteral("fast"),
                                 const QString& textureMode =
                                     QStringLiteral("auto"),
                                 std::optional<bool> sourceOptimizations =
                                     std::nullopt);
    static PatcherStatus updateConfiguration(
        const QString& selectedPath,
        const QString& pathfindingMode = {},
        const QString& textureMode = {},
        std::optional<bool> sourceOptimizations = std::nullopt);
    static PatcherStatus updatePathfindingMode(
        const QString& selectedPath,
        const QString& pathfindingMode);
    static PatcherStatus updateTextureMode(const QString& selectedPath,
                                           const QString& textureMode);
    static PatcherStatus updateSourceOptimizations(const QString& selectedPath,
                                                   bool enabled);
    static PatcherStatus uninstall(const QString& selectedPath);
    static QJsonObject toJson(const PatcherStatus& value);
    static QString stateName(PatcherState state);
#ifdef KD_SOURCE_PATCH_TESTING
    static void setFailurePointForTesting(const QString& point);
#endif
};

} // namespace kd
