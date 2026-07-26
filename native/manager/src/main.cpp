#include "MainWindow.h"
#include "Patcher.h"

#include <QApplication>
#include <QCoreApplication>
#include <QJsonDocument>
#include <QTextStream>
#include <QTimer>

#include <exception>

namespace {

QString optionValue(const QStringList& arguments, const QString& name)
{
    const qsizetype index = arguments.indexOf(name);
    if (index < 0 || index + 1 >= arguments.size()) {
        return {};
    }
    return arguments.at(index + 1);
}

int runHeadless(int argc, char* argv[])
{
    QCoreApplication application(argc, argv);
    QCoreApplication::setApplicationName(QStringLiteral("KD Hybrid Manager"));
    const QStringList arguments = application.arguments();
    const QString command = optionValue(arguments, QStringLiteral("--headless"));
    const QString appRoot = optionValue(arguments, QStringLiteral("--app-root"));
    if (command.isEmpty() || appRoot.isEmpty()) {
        throw std::runtime_error(
            "Usage: KDHybridManager --headless <status|install|uninstall> "
            "--app-root <path>");
    }
    kd::PatcherStatus result;
    if (command == QLatin1String("status")) {
        result = kd::Patcher::status(appRoot);
    } else if (command == QLatin1String("install")) {
        result = kd::Patcher::install(appRoot);
    } else if (command == QLatin1String("uninstall")) {
        result = kd::Patcher::uninstall(appRoot);
    } else {
        throw std::runtime_error("Unknown headless command");
    }
    QTextStream(stdout)
        << QJsonDocument(kd::Patcher::toJson(result))
               .toJson(QJsonDocument::Indented);
    return result.state == kd::PatcherState::Modified
            || result.state == kd::PatcherState::Incomplete
        ? 2
        : 0;
}

} // namespace

int main(int argc, char* argv[])
{
    try {
        const QStringList rawArguments = [&] {
            QStringList values;
            for (int index = 0; index < argc; ++index) {
                values.append(QString::fromLocal8Bit(argv[index]));
            }
            return values;
        }();
        if (rawArguments.contains(QStringLiteral("--headless"))) {
            return runHeadless(argc, argv);
        }

        QApplication application(argc, argv);
        QCoreApplication::setOrganizationName(QStringLiteral("KD Hybrid"));
        QCoreApplication::setOrganizationDomain(
            QStringLiteral("github.com/Whyaremax/rusted-kinks"));
        QCoreApplication::setApplicationName(QStringLiteral("KD Hybrid Manager"));
        QCoreApplication::setApplicationVersion(
            QString::fromLatin1(KD_MANAGER_VERSION));
        QApplication::setStyle(QStringLiteral("Fusion"));

        const QString initialPath =
            optionValue(application.arguments(), QStringLiteral("--game-root"));
        const QString screenshotPath =
            optionValue(application.arguments(), QStringLiteral("--screenshot"));
        MainWindow window(initialPath);
        window.show();
        if (!screenshotPath.isEmpty()) {
            QTimer::singleShot(750, &application, [&] {
                const bool saved = window.grab().save(screenshotPath);
                application.exit(saved ? 0 : 3);
            });
        }
        return application.exec();
    } catch (const std::exception& error) {
        QTextStream(stderr) << "KD Hybrid Manager error: " << error.what()
                            << Qt::endl;
        return 1;
    }
}
