#pragma once

#include <QStringList>

#include <optional>
#include <stdexcept>

namespace kd {

inline std::optional<bool>
parseHeadlessSourceMode(const QStringList& arguments)
{
    const QString option = QStringLiteral("--source-mode");
    const qsizetype index = arguments.indexOf(option);
    if (index < 0) {
        return std::nullopt;
    }
    if (arguments.lastIndexOf(option) != index) {
        throw std::invalid_argument(
            "--source-mode may only be specified once");
    }
    if (index + 1 >= arguments.size()
        || arguments.at(index + 1).isEmpty()
        || arguments.at(index + 1).startsWith(QLatin1String("--"))) {
        throw std::invalid_argument(
            "--source-mode requires optimized or original");
    }

    const QString value = arguments.at(index + 1);
    if (value == QLatin1String("optimized")) {
        return true;
    }
    if (value == QLatin1String("original")) {
        return false;
    }
    throw std::invalid_argument(
        QStringLiteral("Unknown source mode: %1; expected optimized or original")
            .arg(value)
            .toUtf8()
            .toStdString());
}

} // namespace kd
