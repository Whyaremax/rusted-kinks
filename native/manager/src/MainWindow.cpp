#include "MainWindow.h"

#include <QApplication>
#include <QBoxLayout>
#include <QDesktopServices>
#include <QDir>
#include <QDragEnterEvent>
#include <QFileDialog>
#include <QFileInfo>
#include <QFrame>
#include <QLabel>
#include <QLineEdit>
#include <QMessageBox>
#include <QMimeData>
#include <QPainter>
#include <QPlainTextEdit>
#include <QProgressBar>
#include <QPushButton>
#include <QSettings>
#include <QTime>
#include <QUrl>

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
    QPixmap image(64, 64);
    image.fill(Qt::transparent);
    QPainter painter(&image);
    painter.setRenderHint(QPainter::Antialiasing);
    painter.setPen(QPen(QColor(QStringLiteral("#f1b15d")), 6,
                        Qt::SolidLine, Qt::RoundCap));
    painter.drawArc(QRectF(8, 19, 30, 26), 45 * 16, 270 * 16);
    painter.setPen(QPen(QColor(QStringLiteral("#bc5371")), 6,
                        Qt::SolidLine, Qt::RoundCap));
    painter.drawArc(QRectF(26, 19, 30, 26), 225 * 16, 270 * 16);
    return QIcon(image);
}

QString exceptionMessage(const std::exception& error)
{
    return QString::fromUtf8(error.what());
}

} // namespace

MainWindow::MainWindow(const QString& initialPath, QWidget* parent)
    : QMainWindow(parent)
{
    setWindowTitle(QStringLiteral("KD Hybrid Manager"));
    setWindowIcon(applicationIcon());
    setMinimumSize(760, 620);
    resize(860, 680);
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
    browseButton_ = new QPushButton(QStringLiteral("Browse…"));
    browseButton_->setObjectName(QStringLiteral("secondaryButton"));
    refreshButton_ = new QPushButton(QStringLiteral("Check"));
    refreshButton_->setObjectName(QStringLiteral("secondaryButton"));
    pathRow->addWidget(pathEdit_, 1);
    pathRow->addWidget(browseButton_);
    pathRow->addWidget(refreshButton_);
    pathLayout->addWidget(pathLabel);
    pathLayout->addLayout(pathRow);
    root->addWidget(pathCard);

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
                       "index.html is backed up and every installed file is "
                       "recorded before changes are committed."));
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
        QLineEdit, QPlainTextEdit {
            background: #111015;
            color: #f4eef2;
            border: 1px solid #403a45;
            border-radius: 6px;
            padding: 9px;
            selection-background-color: #8a3f5b;
        }
        QLineEdit:focus, QPlainTextEdit:focus {
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
            "KD Hybrid will back up index.html, copy the verified bootstrap "
            "payload, and record hashes for safe removal.\n\n"
            "Game saves and Electron userData are not accessed."));
    if (answer != QMessageBox::Yes) {
        return;
    }
    runOperation(QStringLiteral("Install"), [this] {
        return kd::Patcher::install(pathEdit_->text().trimmed());
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
            "The exact backed-up index.html will be restored and only "
            "hash-verified KD Hybrid files will be removed."));
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
            QStringLiteral("Verified KD %1 · Electron package %2")
                .arg(status.inspection.gameVersion,
                     status.inspection.packageVersion));
    } else {
        compatibilityLabel_->setText(
            QStringLiteral("Unknown game bundle · patching disabled"));
    }
    if (status.problems.isEmpty()) {
        detailLabel_->setText(
            status.state == kd::PatcherState::Installed
                ? QStringLiteral(
                      "All installed files, index.html, and the upstream "
                      "bundle match their recorded hashes.")
                : QStringLiteral(
                      "Ready. No bootstrap installation manifest is active."));
    } else {
        detailLabel_->setText(status.problems.join(QStringLiteral("\n")));
    }
    installButton_->setEnabled(
        status.state == kd::PatcherState::NotInstalled
        && status.inspection.knownBundle);
    uninstallButton_->setEnabled(status.state == kd::PatcherState::Installed);
    openFolderButton_->setEnabled(true);
}

void MainWindow::setBusy(bool busy)
{
    progress_->setVisible(busy);
    pathEdit_->setEnabled(!busy);
    browseButton_->setEnabled(!busy);
    refreshButton_->setEnabled(!busy);
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
