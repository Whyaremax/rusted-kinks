#pragma once

#include "Patcher.h"

#include <QMainWindow>

#include <functional>

class QLabel;
class QLineEdit;
class QPlainTextEdit;
class QProgressBar;
class QPushButton;
class QDragEnterEvent;
class QDropEvent;

class MainWindow final : public QMainWindow {
    Q_OBJECT

public:
    explicit MainWindow(const QString& initialPath = {},
                        QWidget* parent = nullptr);

protected:
    void dragEnterEvent(QDragEnterEvent* event) override;
    void dropEvent(QDropEvent* event) override;

private:
    void chooseGame();
    void setGamePath(const QString& path);
    void refreshStatus();
    void installBootstrap();
    void uninstallBootstrap();
    void runOperation(const QString& label,
                      const std::function<kd::PatcherStatus()>& operation);
    void displayStatus(const kd::PatcherStatus& status);
    void setBusy(bool busy);
    void appendLog(const QString& message);

    QLineEdit* pathEdit_ = nullptr;
    QLabel* stateBadge_ = nullptr;
    QLabel* compatibilityLabel_ = nullptr;
    QLabel* detailLabel_ = nullptr;
    QPushButton* installButton_ = nullptr;
    QPushButton* uninstallButton_ = nullptr;
    QPushButton* refreshButton_ = nullptr;
    QPushButton* browseButton_ = nullptr;
    QPushButton* openFolderButton_ = nullptr;
    QProgressBar* progress_ = nullptr;
    QPlainTextEdit* log_ = nullptr;
    kd::PatcherStatus status_;
    bool hasStatus_ = false;
};
