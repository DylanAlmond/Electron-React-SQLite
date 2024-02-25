import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import sqlite3 from 'sqlite3'

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
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
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})


const database = new sqlite3.Database('./resources/db.sqlite3', (err) => {
  if (err) console.error('Database opening error: ', err)
})

database.run(
  `
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    dateCreated DATETIME DEFAULT CURRENT_TIMESTAMP,
    dateDue DATETIME
  )
`,
  (err) => {
    if (err) console.error('Table creation error: ', err)
    else console.log('Connected to db:', database)
  }
)

// CRUD operations

// Create operation
ipcMain.on('create-todo', (_, todo) => {
  const { title, description, dateDue } = todo

  if (!title || !dateDue) {
    return
  }

  const query = 'INSERT INTO todos (title, description, dateDue) VALUES (?, ?, ?)';
  database.run(query, [title, description, dateDue], (err) => {
    if (err) console.error('Create operation error: ', err)
    else console.log('Todo created successfully')
  })
})

// Read operation
ipcMain.on('read-todos', (event) => {
  const query = 'SELECT * FROM todos'
  database.all(query, (err, rows) => {
    if (err) console.error('Read operation error: ', err)
    else event.reply('todos-read-reply', rows)
  })
})

// Update operation
ipcMain.on('update-todo', (_, todo) => {
  const { id, title, description, dateDue } = todo

  if (!id || !title || !dateDue) {
    return
  }

  const query = 'UPDATE todos SET title=?, description=?, dateDue=? WHERE id=?'
  database.run(query, [title, description, dateDue, id], (err) => {
    if (err) console.error('Update operation error: ', err)
    else console.log('Todo updated successfully')
  })
})

// Delete operation
ipcMain.on('delete-todo', (_, id) => {
  if (!id) return

  const query = 'DELETE FROM todos WHERE id=?'
  database.run(query, [id], (err) => {
    if (err) console.error('Delete operation error: ', err)
    else console.log('Todo deleted successfully')
  })
})