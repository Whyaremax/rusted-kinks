// SPDX-License-Identifier: MPL-2.0
//
// Exact, version-gated transformations adapted from Kinky Dungeon 5.4.92.
// Kinky Dungeon is Copyright Strait Laced Games LLC.

#include "SourcePatches.h"

#include <QCryptographicHash>
#include <QFile>
#include <QRegularExpression>

#include <stdexcept>

namespace {

constexpr auto kPatchId = "kd-5.4.92-source-optimizations-v6";
constexpr auto kUpstreamVersion = "5.4.92";
constexpr auto kInputSha256 =
    "2d3041a085cbe475a63227ff40709f6d9c1595c77a58545c69edf359a57605a4";
constexpr auto kOutputSha256 =
    "aa4c09e73de34b1ab6eea5328880049578963c7c3dcbaae07728ca408da59f92";
constexpr auto kSourceUrl =
    "https://github.com/Ada18980/KinkiestDungeon/tree/"
    "5c96c4c1e67faf136ba2c167ed889a9e29005a18";
constexpr auto kPatchResource =
    ":/bootstrap/source/MPL-2.0/upstream-patches/kd-5.4.92/"
    "bundle-optimizations-v6.patch";

QString sha256(const QByteArray& bytes)
{
    return QString::fromLatin1(
        QCryptographicHash::hash(bytes, QCryptographicHash::Sha256).toHex());
}

[[noreturn]] void failPatch(const QString& detail)
{
    throw std::runtime_error(
        QStringLiteral("Source patch %1 %2")
            .arg(QString::fromLatin1(kPatchId), detail)
            .toStdString());
}

QByteArray readPatch()
{
    QFile file(QString::fromLatin1(kPatchResource));
    if (!file.open(QIODevice::ReadOnly)) {
        failPatch(QStringLiteral("resource is unavailable"));
    }
    return file.readAll();
}

QByteArray applyUnifiedPatch(const QByteArray& bundle,
                             const QByteArray& patchBytes)
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
        failPatch(QStringLiteral("contains no unified diff hunks"));
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
            failPatch(QStringLiteral("has an invalid hunk header"));
        }
        const qsizetype oldStart = match.captured(1).toLongLong();
        const qsizetype oldCount =
            match.captured(2).isEmpty() ? 1 : match.captured(2).toLongLong();
        const qsizetype newCount =
            match.captured(4).isEmpty() ? 1 : match.captured(4).toLongLong();
        const qsizetype targetIndex = qMax<qsizetype>(0, oldStart - 1);
        if (targetIndex < sourceIndex || targetIndex > sourceLines.size()) {
            failPatch(QStringLiteral("hunk starts outside the source bundle"));
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
                failPatch(QStringLiteral("contains an invalid hunk line"));
            }
            ++patchIndex;
        }
        if (consumedOld != oldCount || producedNew != newCount) {
            failPatch(
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

} // namespace

namespace kd {

QString sourcePatchInputSha256()
{
    return QString::fromLatin1(kInputSha256);
}

QString sourcePatchOutputSha256()
{
    return QString::fromLatin1(kOutputSha256);
}

bool isKnownSourceBundle(const QString& value)
{
    return value.compare(QLatin1String(kInputSha256), Qt::CaseInsensitive) == 0
        || value.compare(QLatin1String(kOutputSha256), Qt::CaseInsensitive)
        == 0;
}

SourcePatchResult applyKnownSourcePatch(const QByteArray& bundle,
                                        const QString& inputSha256)
{
    if (inputSha256.compare(QLatin1String(kInputSha256), Qt::CaseInsensitive)
        != 0) {
        return {};
    }

    const QByteArray text = applyUnifiedPatch(bundle, readPatch());
    if (sha256(text) != QLatin1String(kOutputSha256)) {
        failPatch(QStringLiteral("produced an unexpected bundle hash"));
    }
    return {
        true,
        text,
        QJsonObject{
            {QStringLiteral("id"), QString::fromLatin1(kPatchId)},
            {QStringLiteral("path"), QStringLiteral("out/main.js")},
            {QStringLiteral("originalSha256"),
             QString::fromLatin1(kInputSha256)},
            {QStringLiteral("patchedSha256"),
             QString::fromLatin1(kOutputSha256)},
            {QStringLiteral("upstreamVersion"),
             QString::fromLatin1(kUpstreamVersion)},
            {QStringLiteral("sourceUrl"), QString::fromLatin1(kSourceUrl)},
        },
    };
}

} // namespace kd
