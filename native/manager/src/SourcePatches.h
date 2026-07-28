// SPDX-License-Identifier: MPL-2.0
#pragma once

#include <QByteArray>
#include <QJsonObject>
#include <QString>

namespace kd {

struct SourcePatchResult {
    bool applied = false;
    QByteArray bytes;
    QJsonObject manifest;
};

QString sourcePatchInputSha256();
QString sourcePatchOutputSha256();
bool isKnownSourceBundle(const QString& sha256);
SourcePatchResult applyKnownSourcePatch(const QByteArray& bundle,
                                        const QString& inputSha256);

} // namespace kd
