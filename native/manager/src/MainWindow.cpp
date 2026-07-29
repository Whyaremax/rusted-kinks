#include "MainWindow.h"

#include <QApplication>
#include <QBoxLayout>
#include <QComboBox>
#include <QDesktopServices>
#include <QDir>
#include <QDragEnterEvent>
#include <QFileDialog>
#include <QFileInfo>
#include <QFrame>
#include <QIcon>
#include <QLabel>
#include <QLineEdit>
#include <QMessageBox>
#include <QMimeData>
#include <QPlainTextEdit>
#include <QProgressBar>
#include <QPushButton>
#include <QSettings>
#include <QTime>
#include <QUrl>

#ifdef Q_OS_WIN
#include <windows.h>
#include <shellapi.h>
#endif

namespace {

QFrame* card()
{
    auto* frame = new QFrame;
    frame->setObjectName(QStringLiteral("card"));
    frame->setFrameShape(QFrame::NoFrame);
    return frame;
}

QIcon applicationIcon()
{
    return QIcon(QStringLiteral(":/icons/kd-hybrid-bandage.png"));
}

QString exceptionMessage(const std::exception& error)
{
    return QString::fromUtf8(error.what());
}

bool relaunchElevated(const QString& gameRoot)
{
#ifdef Q_OS_WIN
    const QString executable =
        QDir::toNativeSeparators(QCoreApplication::applicationFilePath());
    QString escapedRoot = QDir::toNativeSeparators(gameRoot);
    escapedRoot.replace(QStringLiteral("\""), QStringLiteral("\\\""));
    const QString parameters =
        QStringLiteral("--game-root \"%1\"").arg(escapedRoot);
    SHELLEXECUTEINFOW info{};
    info.cbSize = sizeof(info);
    info.fMask = SEE_MASK_NOCLOSEPROCESS;
    info.lpVerb = L"runas";
    info.lpFile = reinterpret_cast<LPCWSTR>(executable.utf16());
    info.lpParameters = reinterpret_cast<LPCWSTR>(parameters.utf16());
    info.nShow = SW_SHOWNORMAL;
    if (!ShellExecuteExW(&info)) {
        return false;
    }
    if (info.hProcess != nullptr) {
        CloseHandle(info.hProcess);
    }
    return true;
#else
    Q_UNUSED(gameRoot);
    return false;
#endif
}

} // namespace

MainWindow::MainWindow(const QString& initialPath, QWidget* parent)
    : QMainWindow(parent)
{
    setWindowTitle(QStringLiteral("KD Hybrid Manager"));
    setWindowIcon(applicationIcon());
    setMinimumSize(760, 800);
    resize(860, 900);
    setAcceptDrops(true);

    auto* central = new QWidget;
    central->setObjectName(QStringLiteral("central"));
    auto* root = new QVBoxLayout(central);
    root->setContentsMargins(28, 24, 28, 24);
    root->setSpacing(16);

    auto* eyebrow = new QLabel(QStringLiteral("KD HYBRID"));
    eyebrow->setObjectName(QStringLiteral("eyebrow"));
    auto* title = new QLabel(QStringLiteral("Bootstrap Manager"));
    title->setObjectName(QStringLiteral("title"));
    auto* subtitle = new QLabel(
        QStringLiteral("Verified, reversible early loading for your own "
                       "Kinky Dungeon installation."));
    subtitle->setObjectName(QStringLiteral("subtitle"));
    subtitle->setWordWrap(true);
    root->addWidget(eyebrow);
    root->addWidget(title);
    root->addWidget(subtitle);

    auto* pathCard = card();
    auto* pathLayout = new QVBoxLayout(pathCard);
    auto* pathLabel = new QLabel(QStringLiteral("Game installation"));
    pathLabel->setObjectName(QStringLiteral("sectionTitle"));
    auto* pathRow = new QHBoxLayout;
    pathEdit_ = new QLineEdit;
    pathEdit_->setPlaceholderText(
        QStringLiteral("Choose the folder containing KinkyDungeon.exe"));
    pathEdit_->setClearButtonEnabled(true);
    browseButton_ = new QPushButton(QStringLiteral("Browse..."));
    browseButton_->setObjectName(QStringLiteral("secondaryButton"));
    refreshButton_ = new QPushButton(QStringLiteral("Check"));
    refreshButton_->setObjectName(QStringLiteral("secondaryButton"));
    pathRow->addWidget(pathEdit_, 1);
    pathRow->addWidget(browseButton_);
    pathRow->addWidget(refreshButton_);
    pathLayout->addWidget(pathLabel);
    pathLayout->addLayout(pathRow);
    root->addWidget(pathCard);

    auto* plannerCard = card();
    plannerCard->setMinimumHeight(230);
    auto* plannerLayout = new QVBoxLayout(plannerCard);
    auto* plannerLabel = new QLabel(QStringLiteral("Pathfinding strategy"));
    plannerLabel->setObjectName(QStringLiteral("sectionTitle"));
    auto* plannerDetail = new QLabel(
        QStringLiteral("Choose maximum route quality, crowd throughput, or "
                       "more natural-looking NPC movement."));
    plannerDetail->setObjectName(QStringLiteral("detail"));
    plannerDetail->setWordWrap(true);
    auto* plannerRow = new QHBoxLayout;
    pathfindingMode_ = new QComboBox;
    pathfindingMode_->addItem(
        QStringLiteral("Route Quality (lowest map cost)"),
        QStringLiteral("quality"));
    pathfindingMode_->addItem(
        QStringLiteral("Optimized (default)"),
        QStringLiteral("fast"));
    pathfindingMode_->addItem(
        QStringLiteral("Human-like (fewer zigzags)"),
        QStringLiteral("human"));
    pathfindingMode_->setCurrentIndex(1);
    applyModeButton_ = new QPushButton(QStringLiteral("Apply mode"));
    applyModeButton_->setObjectName(QStringLiteral("secondaryButton"));
    applyModeButton_->setEnabled(false);
    plannerRow->addWidget(pathfindingMode_, 1);
    plannerLayout->addWidget(plannerLabel);
    plannerLayout->addWidget(plannerDetail);
    plannerLayout->addLayout(plannerRow);

    auto* textureLabel = new QLabel(QStringLiteral("Texture memory policy"));
    textureLabel->setObjectName(QStringLiteral("sectionTitle"));
    auto* textureDetail = new QLabel(
        QStringLiteral("Automatic is recommended. Other choices force the "
                       "original, full-size, or mobile texture atlas."));
    textureDetail->setObjectName(QStringLiteral("detail"));
    textureDetail->setWordWrap(true);
    auto* textureRow = new QHBoxLayout;
    textureMode_ = new QComboBox;
    textureMode_->addItem(QStringLiteral("Automatic (recommended)"),
                          QStringLiteral("auto"));
    textureMode_->addItem(QStringLiteral("Original KD setting"),
                          QStringLiteral("original"));
    textureMode_->addItem(QStringLiteral("Full atlas"),
                          QStringLiteral("full"));
    textureMode_->addItem(QStringLiteral("Mobile atlas"),
                          QStringLiteral("mobile"));
    textureRow->addWidget(textureMode_, 1);
    textureRow->addWidget(applyModeButton_);
    plannerLayout->addSpacing(8);
    plannerLayout->addWidget(textureLabel);
    plannerLayout->addWidget(textureDetail);
    plannerLayout->addLayout(textureRow);
    root->addWidget(plannerCard);

    auto* statusCard = card();
    auto* statusLayout = new QVBoxLayout(statusCard);
    auto* statusHeader = new QHBoxLayout;
    auto* statusTitle = new QLabel(QStringLiteral("Early bootstrap"));
    statusTitle->setObjectName(QStringLiteral("sectionTitle"));
    stateBadge_ = new QLabel(QStringLiteral("NOT CHECKED"));
    stateBadge_->setObjectName(QStringLiteral("badge"));
    statusHeader->addWidget(statusTitle);
    statusHeader->addStretch();
    statusHeader->addWidget(stateBadge_);
    compatibilityLabel_ =
        new QLabel(QStringLiteral("Select a game installation to begin."));
    compatibilityLabel_->setObjectName(QStringLiteral("compatibility"));
    detailLabel_ = new QLabel(
        QStringLiteral("The manager never opens Electron userData or saves."));
    detailLabel_->setObjectName(QStringLiteral("detail"));
    detailLabel_->setWordWrap(true);
    auto* actions = new QHBoxLayout;
    installButton_ = new QPushButton(QStringLiteral("Install bootstrap"));
    installButton_->setObjectName(QStringLiteral("primaryButton"));
    uninstallButton_ = new QPushButton(QStringLiteral("Uninstall safely"));
    uninstallButton_->setObjectName(QStringLiteral("dangerButton"));
    openFolderButton_ = new QPushButton(QStringLiteral("Open app folder"));
    openFolderButton_->setObjectName(QStringLiteral("secondaryButton"));
    installButton_->setEnabled(false);
    uninstallButton_->setEnabled(false);
    openFolderButton_->setEnabled(false);
    actions->addWidget(installButton_);
    actions->addWidget(uninstallButton_);
    actions->addStretch();
    actions->addWidget(openFolderButton_);
    statusLayout->addLayout(statusHeader);
    statusLayout->addWidget(compatibilityLabel_);
    statusLayout->addWidget(detailLabel_);
    statusLayout->addSpacing(4);
    statusLayout->addLayout(actions);
    root->addWidget(statusCard);

    auto* safety = new QLabel(
        QStringLiteral("Safety: the bootstrap is installed only after the "
                       "11 MB upstream bundle matches a known SHA-256. "
                       "index.html and any source-patched bundle are backed up; "
                       "every installed file is recorded before activation. "
                       "It runs as your current user and offers administrator "
                       "relaunch only if the game folder denies writes."));
    safety->setObjectName(QStringLiteral("safety"));
    safety->setWordWrap(true);
    root->addWidget(safety);

    progress_ = new QProgressBar;
    progress_->setRange(0, 0);
    progress_->setTextVisible(false);
    progress_->hide();
    root->addWidget(progress_);

    auto* logLabel = new QLabel(QStringLiteral("Activity"));
    logLabel->setObjectName(QStringLiteral("sectionTitle"));
    log_ = new QPlainTextEdit;
    log_->setReadOnly(true);
    log_->setMaximumBlockCount(300);
    log_->setPlaceholderText(QStringLiteral("Status and safety details appear here."));
    root->addWidget(logLabel);
    root->addWidget(log_, 1);
    setCentralWidget(central);

    setStyleSheet(QStringLiteral(R"(
        QMainWindow, QWidget#central {
            background: #151419;
        }
        QWidget {
            background: transparent;
            color: #ece8e4;
            font-family: "Segoe UI", "Inter", sans-serif;
            font-size: 14px;
        }
        QLabel#eyebrow {
            color: #d88a55;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 2px;
        }
        QLabel#title {
            color: #fffaf5;
            font-size: 32px;
            font-weight: 700;
        }
        QLabel#subtitle, QLabel#detail {
            color: #aaa4ad;
        }
        QLabel#sectionTitle {
            color: #f6f0eb;
            font-size: 16px;
            font-weight: 650;
        }
        QLabel#badge {
            background: #37323b;
            color: #d9d2dc;
            border-radius: 10px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
        }
        QLabel#compatibility {
            color: #e4b878;
            font-weight: 600;
            margin-top: 6px;
        }
        QLabel#safety {
            background: #211e25;
            color: #bdb5c1;
            border-left: 3px solid #8b5667;
            border-radius: 5px;
            padding: 11px;
        }
        QFrame#card {
            background: #201e24;
            border: 1px solid #35313a;
            border-radius: 10px;
        }
        QLineEdit, QPlainTextEdit, QComboBox {
            background: #111015;
            color: #f4eef2;
            border: 1px solid #403a45;
            border-radius: 6px;
            padding: 9px;
            selection-background-color: #8a3f5b;
        }
        QComboBox {
            min-height: 20px;
            padding: 6px 9px;
        }
        QComboBox::drop-down {
            width: 28px;
            border: none;
        }
        QLineEdit:focus, QPlainTextEdit:focus, QComboBox:focus {
            border-color: #bc6a80;
        }
        QPushButton {
            min-height: 34px;
            padding: 0 15px;
            border-radius: 6px;
            font-weight: 600;
        }
        QPushButton#primaryButton {
            background: #a64461;
            color: white;
            border: 1px solid #c65d7c;
        }
        QPushButton#primaryButton:hover { background: #b94d6c; }
        QPushButton#dangerButton {
            background: #35232b;
            color: #f0b7c4;
            border: 1px solid #704150;
        }
        QPushButton#secondaryButton {
            background: #302c34;
            color: #e7e0e8;
            border: 1px solid #49434e;
        }
        QPushButton:hover { border-color: #9c7583; }
        QPushButton:disabled {
            background: #27242a;
            color: #6f6972;
            border-color: #332f36;
        }
        QPushButton#primaryButton:disabled,
        QPushButton#dangerButton:disabled,
        QPushButton#secondaryButton:disabled {
            background: #27242a;
            color: #6f6972;
            border-color: #332f36;
        }
        QProgressBar {
            background: #252129;
            border: none;
            border-radius: 3px;
            max-height: 6px;
        }
        QProgressBar::chunk { background: #bd5472; border-radius: 3px; }
    )"));

    connect(browseButton_, &QPushButton::clicked, this, &MainWindow::chooseGame);
    connect(refreshButton_, &QPushButton::clicked, this,
            &MainWindow::refreshStatus);
    connect(pathEdit_, &QLineEdit::returnPressed, this,
            &MainWindow::refreshStatus);
    connect(installButton_, &QPushButton::clicked, this,
            &MainWindow::installBootstrap);
    connect(applyModeButton_, &QPushButton::clicked, this,
            &MainWindow::applyConfiguration);
    connect(uninstallButton_, &QPushButton::clicked, this,
            &MainWindow::uninstallBootstrap);
    connect(openFolderButton_, &QPushButton::clicked, this, [this] {
        if (hasStatus_) {
            QDesktopServices::openUrl(
                QUrl::fromLocalFile(status_.inspection.appRoot));
        }
    });

    QSettings settings;
    const QString remembered =
        settings.value(QStringLiteral("gameRoot")).toString();
    const QString startingPath =
        !initialPath.isEmpty() ? initialPath : remembered;
    if (!startingPath.isEmpty()) {
        setGamePath(startingPath);
        refreshStatus();
    }
}

void MainWindow::dragEnterEvent(QDragEnterEvent* event)
{
    if (event->mimeData()->hasUrls()
        && event->mimeData()->urls().size() == 1
        && event->mimeData()->urls().first().isLocalFile()) {
        event->acceptProposedAction();
    }
}

void MainWindow::dropEvent(QDropEvent* event)
{
    if (!event->mimeData()->hasUrls()
        || event->mimeData()->urls().size() != 1
        || !event->mimeData()->urls().first().isLocalFile()) {
        event->ignore();
        return;
    }
    const QString path = event->mimeData()->urls().first().toLocalFile();
    setGamePath(path);
    refreshStatus();
    event->acceptProposedAction();
}

void MainWindow::chooseGame()
{
    const QString selected = QFileDialog::getExistingDirectory(
        this, QStringLiteral("Choose Kinky Dungeon installation"),
        pathEdit_->text());
    if (!selected.isEmpty()) {
        setGamePath(selected);
        refreshStatus();
    }
}

void MainWindow::setGamePath(const QString& path)
{
    pathEdit_->setText(QDir::toNativeSeparators(path));
    QSettings settings;
    settings.setValue(QStringLiteral("gameRoot"), path);
}

void MainWindow::refreshStatus()
{
    if (pathEdit_->text().trimmed().isEmpty()) {
        return;
    }
    setBusy(true);
    try {
        status_ = kd::Patcher::status(pathEdit_->text().trimmed());
        hasStatus_ = true;
        displayStatus(status_);
        appendLog(
            QStringLiteral("Checked %1").arg(status_.inspection.appRoot));
    } catch (const std::exception& error) {
        hasStatus_ = false;
        stateBadge_->setText(QStringLiteral("INVALID PATH"));
        stateBadge_->setStyleSheet(
            QStringLiteral("background:#5b2930;color:#ffd8dd;"));
        compatibilityLabel_->setText(exceptionMessage(error));
        detailLabel_->setText(
            QStringLiteral("Choose the game root or its resources/app folder."));
        installButton_->setEnabled(false);
        uninstallButton_->setEnabled(false);
        openFolderButton_->setEnabled(false);
        appendLog(QStringLiteral("Check failed: %1").arg(exceptionMessage(error)));
    }
    setBusy(false);
}

void MainWindow::installBootstrap()
{
    if (!hasStatus_ || !status_.inspection.knownBundle) {
        return;
    }
    const auto answer = QMessageBox::question(
        this, QStringLiteral("Install early bootstrap?"),
        QStringLiteral(
            "KD Hybrid will back up index.html and out/main.js, apply the "
            "verified source optimization, copy the bootstrap payload, and "
            "record hashes for safe removal.\n\n"
            "Game saves and Electron userData are not accessed."));
    if (answer != QMessageBox::Yes) {
        return;
    }
    runOperation(QStringLiteral("Install"), [this] {
        return kd::Patcher::install(
            pathEdit_->text().trimmed(), false,
            pathfindingMode_->currentData().toString(),
            textureMode_->currentData().toString());
    });
}

void MainWindow::applyConfiguration()
{
    if (!hasStatus_ || status_.state != kd::PatcherState::Installed) {
        return;
    }
    runOperation(QStringLiteral("Update settings"), [this] {
        return kd::Patcher::updateConfiguration(
            pathEdit_->text().trimmed(),
            pathfindingMode_->currentData().toString(),
            textureMode_->currentData().toString());
    });
}

void MainWindow::uninstallBootstrap()
{
    if (!hasStatus_ || status_.state != kd::PatcherState::Installed) {
        return;
    }
    const auto answer = QMessageBox::question(
        this, QStringLiteral("Uninstall bootstrap?"),
        QStringLiteral(
            "The exact backed-up index.html and out/main.js will be restored, "
            "and only hash-verified KD Hybrid files will be removed."));
    if (answer != QMessageBox::Yes) {
        return;
    }
    runOperation(QStringLiteral("Uninstall"), [this] {
        return kd::Patcher::uninstall(pathEdit_->text().trimmed());
    });
}

void MainWindow::runOperation(
    const QString& label,
    const std::function<kd::PatcherStatus()>& operation)
{
    setBusy(true);
    appendLog(label + QStringLiteral(" started."));
    QApplication::processEvents();
    try {
        status_ = operation();
        hasStatus_ = true;
        displayStatus(status_);
        appendLog(label + QStringLiteral(" completed safely."));
    } catch (const kd::PatcherError& error) {
        appendLog(label + QStringLiteral(" failed: ") + exceptionMessage(error));
        if (error.code() == kd::PatcherErrorCode::PermissionDenied) {
            const auto answer = QMessageBox::question(
                this, QStringLiteral("Folder permission denied"),
                exceptionMessage(error)
                    + QStringLiteral(
                        "\n\nRelaunch KD Hybrid Manager as administrator? "
                        "Normal runs never request administrator access."));
            if (answer == QMessageBox::Yes) {
                if (relaunchElevated(pathEdit_->text().trimmed())) {
                    appendLog(QStringLiteral(
                        "Elevated manager launched. This window will close."));
                    QCoreApplication::quit();
                    return;
                }
                QMessageBox::critical(
                    this, QStringLiteral("Relaunch failed"),
                    QStringLiteral(
                        "Windows did not start the elevated manager."));
            }
        } else {
            QMessageBox::critical(this, label + QStringLiteral(" failed"),
                                  exceptionMessage(error));
        }
        refreshStatus();
    } catch (const std::exception& error) {
        appendLog(label + QStringLiteral(" failed: ") + exceptionMessage(error));
        QMessageBox::critical(this, label + QStringLiteral(" failed"),
                              exceptionMessage(error));
        refreshStatus();
    }
    setBusy(false);
}

void MainWindow::displayStatus(const kd::PatcherStatus& status)
{
    stateBadge_->setText(kd::Patcher::stateName(status.state).toUpper());
    QString badgeStyle;
    switch (status.state) {
    case kd::PatcherState::Installed:
        badgeStyle = QStringLiteral("background:#244738;color:#bdf4d4;");
        break;
    case kd::PatcherState::NotInstalled:
        badgeStyle = QStringLiteral("background:#37323b;color:#d9d2dc;");
        break;
    case kd::PatcherState::Modified:
        badgeStyle = QStringLiteral("background:#66451e;color:#ffe0a3;");
        break;
    case kd::PatcherState::Incomplete:
        badgeStyle = QStringLiteral("background:#5b2930;color:#ffd8dd;");
        break;
    }
    stateBadge_->setStyleSheet(badgeStyle);

    if (status.inspection.knownBundle) {
        compatibilityLabel_->setText(
            QStringLiteral("Verified KD %1 | Electron package %2")
                .arg(status.inspection.gameVersion,
                     status.inspection.packageVersion));
    } else {
        compatibilityLabel_->setText(
            QStringLiteral("Unknown game bundle | patching disabled"));
    }
    if (status.problems.isEmpty()) {
        detailLabel_->setText(
            status.state == kd::PatcherState::Installed
                ? QStringLiteral(
                      "Bootstrap and source optimization are installed; all "
                      "files and backups match their recorded hashes.")
                : status.inspection.sourcePatched
                ? QStringLiteral(
                      "This bundle has the recognized source patch but no "
                      "installation manifest or original backup. Restore a "
                      "clean game bundle before installing.")
                : QStringLiteral(
                      "Ready. No bootstrap installation manifest is active."));
    } else {
        detailLabel_->setText(status.problems.join(QStringLiteral("\n")));
    }
    installButton_->setEnabled(
        status.state == kd::PatcherState::NotInstalled
        && status.inspection.knownBundle
        && !status.inspection.sourcePatched);
    uninstallButton_->setEnabled(status.state == kd::PatcherState::Installed);
    applyModeButton_->setEnabled(
        status.state == kd::PatcherState::Installed);
    if (status.state == kd::PatcherState::Installed) {
        const QString mode =
            status.manifest.value(QStringLiteral("settings"))
                .toObject()
                .value(QStringLiteral("pathfindingMode"))
                .toString(QStringLiteral("fast"));
        const int index = pathfindingMode_->findData(mode);
        if (index >= 0) {
            pathfindingMode_->setCurrentIndex(index);
        }
        const QString textureMode =
            status.manifest.value(QStringLiteral("settings"))
                .toObject()
                .value(QStringLiteral("textureMode"))
                .toString(QStringLiteral("auto"));
        const int textureIndex = textureMode_->findData(textureMode);
        if (textureIndex >= 0) {
            textureMode_->setCurrentIndex(textureIndex);
        }
    }
    openFolderButton_->setEnabled(true);
}

void MainWindow::setBusy(bool busy)
{
    progress_->setVisible(busy);
    pathEdit_->setEnabled(!busy);
    browseButton_->setEnabled(!busy);
    refreshButton_->setEnabled(!busy);
    pathfindingMode_->setEnabled(!busy);
    textureMode_->setEnabled(!busy);
    applyModeButton_->setEnabled(!busy && hasStatus_
                                 && status_.state
                                        == kd::PatcherState::Installed);
    if (busy) {
        installButton_->setEnabled(false);
        uninstallButton_->setEnabled(false);
    } else if (hasStatus_) {
        displayStatus(status_);
    }
}

void MainWindow::appendLog(const QString& message)
{
    log_->appendPlainText(
        QStringLiteral("[%1] %2")
            .arg(QTime::currentTime().toString(QStringLiteral("HH:mm:ss")),
                 message));
}
