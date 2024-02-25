import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Notification,
  Tray,
  Menu
} from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import sqlite3 from 'sqlite3';

let mainWindow;
let isQuiting;
let tray;
let database;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault();
      mainWindow.hide();
      e.returnValue = false;
    }
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  createWindow();

  tray = new Tray(icon);

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open',
        click: function () {
          mainWindow.show();
        }
      },
      {
        label: 'Quit',
        click: function () {
          app.isQuiting = true;
          app.quit();
        }
      }
    ])
  );

  initDB();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', function () {
  isQuiting = true;
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function initDB() {
  database = new sqlite3.Database('./resources/db.sqlite3', (err) => {
    if (err) console.error('Database opening error: ', err);
  });

  database.run(
    `
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      dateCreated DATETIME DEFAULT CURRENT_TIMESTAMP,
      dateDue DATETIME,
      notificationSentToday BOOLEAN DEFAULT FALSE,
      notificationSentTomorrow BOOLEAN DEFAULT FALSE
    )
  `,
    (err) => {
      if (err) console.error('Table creation error: ', err);
      else {
        const notification = new Notification({
          title: 'Connected to DB',
          body: `Connected to database successfully.`
        });

        notification.show();

        checkDueDates();

        setInterval(checkDueDates, 30 * 60 * 1000); // Run every 30 mins
      }
    }
  );
}

// CRUD operations

// Create
ipcMain.on('create-todo', (_, todo) => {
  const { title, description, dateDue } = todo;

  if (!title || !dateDue) {
    return;
  }

  const query =
    'INSERT INTO todos (title, description, dateDue) VALUES (?, ?, ?)';
  database.run(query, [title, description, dateDue], (err) => {
    if (err) console.error('Create operation error: ', err);
    else {
      const notification = new Notification({
        title: 'Task Created',
        body: `Task "${title}" created successfully.`
      });

      notification.show();
    }
  });
});

// Read
ipcMain.on('read-todos', (event) => {
  const query = 'SELECT * FROM todos';
  database.all(query, (err, rows) => {
    if (err) console.error('Read operation error: ', err);
    else event.reply('todos-read-reply', rows);
  });
});

// Update
ipcMain.on('update-todo', (_, todo) => {
  const {
    id,
    title,
    description,
    dateDue,
    notificationSentToday,
    notificationSentTomorrow
  } = todo;

  if (!id || !title || !dateDue) {
    return;
  }

  const query =
    'UPDATE todos SET title=?, description=?, dateDue=?, notificationSentToday=?, notificationSentTomorrow=? WHERE id=?';
  database.run(
    query,
    [
      title,
      description,
      dateDue,
      notificationSentToday,
      notificationSentTomorrow,
      id
    ],
    (err) => {
      if (err) console.error('Update operation error: ', err);
      else {
        const notification = new Notification({
          title: 'Task Updated',
          body: `Task "${title}" updated successfully.`
        });

        notification.show();
      }
    }
  );
});

// Delete
ipcMain.on('delete-todo', (_, id) => {
  if (!id) return;

  const query = 'DELETE FROM todos WHERE id=?';
  database.run(query, [id], (err) => {
    if (err) console.error('Delete operation error: ', err);
    else {
      const notification = new Notification({
        title: 'Task Deleted',
        body: `Task deleted successfully.`
      });

      notification.show();
    }
  });
});

function checkDueDates() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const query = 'SELECT * FROM todos WHERE dateDue >= ? AND dateDue < ?';
  database.all(
    query,
    [now.toISOString(), dayAfter.toISOString()],
    (err, rows) => {
      if (err) {
        console.error('Error checking due tasks: ', err);
        return;
      }

      console.log(rows);

      rows.forEach((todo) => {
        const isToday = tomorrow > new Date(todo.dateDue);
        const isTomorrow = dayAfter > new Date(todo.dateDue);

        if (isToday && !todo.notificationSentToday) {
          const notificationToday = new Notification({
            title: 'Task Due Today',
            body: `Task "${todo.title}" is due today.`
          });

          notificationToday.show();

          const updateQuery =
            'UPDATE todos SET notificationSentToday=1 WHERE id=?';
          database.run(updateQuery, [todo.id], (updateErr) => {
            if (updateErr) {
              console.error(
                'Error updating notification status for today: ',
                updateErr
              );
            }
          });

          return;
        }

        if (isTomorrow && !todo.notificationSentTomorrow) {
          if (todo.notificationSentToday) return;

          const notificationTomorrow = new Notification({
            title: 'Task Due Tomorrow',
            body: `Task "${todo.title}" is due tomorrow.`
          });

          notificationTomorrow.show();

          const updateQuery =
            'UPDATE todos SET notificationSentTomorrow=1 WHERE id=?';
          database.run(updateQuery, [todo.id], (updateErr) => {
            if (updateErr) {
              console.error(
                'Error updating notification status for tomorrow: ',
                updateErr
              );
            }
          });

          return;
        }
      });
    }
  );
}
