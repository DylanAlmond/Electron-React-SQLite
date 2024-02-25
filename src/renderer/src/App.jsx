import { useEffect, useRef, useState } from 'react';
const { ipcRenderer } = window.electron;

const displayDate = (date) => {
  if (isNaN(date)) return '-';

  const currentDate = new Date();
  const tomorrowDate = new Date();

  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  if (date.getDate() === currentDate.getDate()) {
    return 'Today';
  }

  if (date.getDate() === tomorrowDate.getDate()) {
    return 'Tomorrow';
  }

  return date.toDateString();
};

const App = () => {
  const [todos, setTodos] = useState();
  const [currentTodo, setCurrentTodo] = useState();
  const titleElem = useRef();
  const descriptionElem = useRef();
  const dateElem = useRef();

  const createTodo = () => {
    const title = titleElem.current.value;
    const description = descriptionElem.current.value;
    const dateDue = new Date(dateElem.current.value);

    if (!title || isNaN(dateDue)) {
      return;
    }

    const isoDate = dateDue.toISOString();

    ipcRenderer.send('create-todo', {
      title: title,
      description: description,
      dateDue: isoDate
    });

    ipcRenderer.send('read-todos');

    clear();
  };

  const updateTodo = (id) => {
    if (!id) return;

    const title = titleElem.current.value;
    const description = descriptionElem.current.value;
    const dateDue = new Date(dateElem.current.value);

    if (!title || isNaN(dateDue)) {
      return;
    }

    const isoDate = dateDue.toISOString();

    ipcRenderer.send('update-todo', {
      id: id,
      title: title,
      description: description,
      dateDue: isoDate,
      notificationSent: false
    });

    ipcRenderer.send('read-todos');

    clear();
  };

  const deleteTodo = (id) => {
    if (!id) return;

    ipcRenderer.send('delete-todo', id);
    ipcRenderer.send('read-todos');

    setCurrentTodo();
  };

  const updateInputs = (todo) => {
    if (!todo) return;

    titleElem.current.value = todo.title;
    descriptionElem.current.value = todo.description;
    dateElem.current.value = todo.dateDue.slice(0, 10);

    setCurrentTodo(todo);
  };

  const clear = () => {
    titleElem.current.value = '';
    descriptionElem.current.value = '';
    dateElem.current.value = '';

    setCurrentTodo();
  };

  useEffect(() => {
    ipcRenderer.send('read-todos');

    ipcRenderer.on('todos-read-reply', (_, todos) => {
      console.log(todos);
      setTodos(todos);
    });

    return () => {
      ipcRenderer.removeAllListeners('todos-read-reply');
    };
  }, []);

  return (
    <div className='flex gap-6 w-full h-full'>
      <div className='flex flex-col gap-6 w-96 mt-0.5 overflow-y-auto'>
        <h1 className='block mb-2 text-2xl font-medium text-gray-900 dark:text-white'>
          {currentTodo?.title || 'Add Task'}
        </h1>
        <div>
          <label
            htmlFor='title'
            className='block mb-2 text-sm font-medium text-gray-900 dark:text-white'
          >
            Title
          </label>
          <input
            type='text'
            name=''
            className='bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500'
            placeholder='Write your title here...'
            id='title'
            ref={titleElem}
          />
        </div>

        <div>
          <label
            htmlFor='description'
            className='block mb-2 text-sm font-medium text-gray-900 dark:text-white'
          >
            Description
          </label>
          <textarea
            id='description'
            className='block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500'
            placeholder='Write your description here...'
            ref={descriptionElem}
          ></textarea>
        </div>

        <div>
          <label
            htmlFor='dateDue'
            className='block mb-2 text-sm font-medium text-gray-900 dark:text-white'
          >
            Date Due
          </label>

          <input
            type='date'
            name=''
            className='bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500'
            id='dateDue'
            ref={dateElem}
          />
        </div>

        <div className='flex flex-col gap-2'>
          {currentTodo ? (
            <>
              <button
                type='button'
                className='text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none dark:focus:ring-green-800'
                disabled={!currentTodo}
                onClick={() => updateTodo(currentTodo.id)}
              >
                Update Task
              </button>

              <button
                type='button'
                className='text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 focus:outline-none dark:focus:ring-red-800'
                disabled={!currentTodo}
                onClick={() => deleteTodo(currentTodo.id)}
              >
                Delete Task
              </button>

              <button
                type='button'
                className='text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800'
                onClick={() => clear()}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type='button'
              className='text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800'
              onClick={createTodo}
            >
              Add Task
            </button>
          )}
        </div>
      </div>

      <div className='relative overflow-y-auto overflow-x-hidden shadow-md sm:rounded-lg w-full h-full'>
        <table className='w-full h-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400'>
          <thead className='sticky top-0 text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400'>
            <tr>
              <th
                scope='col'
                className='px-6 py-3'
              >
                ID
              </th>
              <th
                scope='col'
                className='px-6 py-3'
              >
                Title
              </th>
              <th
                scope='col'
                className='px-6 py-3'
              >
                Description
              </th>
              <th
                scope='col'
                className='px-6 py-3'
              >
                Created
              </th>
              <th
                scope='col'
                className='px-6 py-3'
              >
                Due
              </th>
              <th
                scope='col'
                className='px-6 py-3'
              >
                Tools
              </th>
            </tr>
          </thead>
          <tbody>
            {todos && todos?.length ? (
              [...todos]
                .sort((a, b) => new Date(a.dateDue) - new Date(b.dateDue))
                .map((todo) => (
                  <tr
                    key={todo.id}
                    className='odd:bg-white odd:dark:bg-gray-900 even:bg-gray-50 even:dark:bg-gray-800 border-b dark:border-gray-700'
                  >
                    <th
                      scope='row'
                      className='px-6 py-4 max-w-40 overflow-hidden text-ellipsis'
                    >
                      {todo.id}
                    </th>
                    <td className='px-6 py-4 max-w-40 overflow-hidden text-ellipsis font-medium text-gray-900 whitespace-nowrap dark:text-white'>
                      {todo.title || '-'}
                    </td>
                    <td className='px-6 py-4 max-w-40 overflow-hidden text-ellipsis'>
                      {todo.description || '-'}
                    </td>
                    <td className='px-6 py-4 max-w-40 overflow-hidden text-ellipsis'>
                      {todo.dateCreated
                        ? new Date(todo.dateCreated).toDateString()
                        : '-'}
                    </td>
                    <td className='px-6 py-4 max-w-40 overflow-hidden text-ellipsis'>
                      {displayDate(new Date(todo.dateDue))}
                    </td>
                    <td className='px-6 py-4'>
                      <a
                        href='#'
                        rel='noreferrer'
                        className='font-medium text-blue-600 dark:text-blue-500 hover:underline'
                        onClick={() => updateInputs(todo)}
                      >
                        Edit
                      </a>
                      <a
                        href='#'
                        rel='noreferrer'
                        className='ml-4 font-medium text-red-600 dark:text-red-500 hover:underline'
                        onClick={() => deleteTodo(todo.id)}
                      >
                        Delete
                      </a>
                    </td>
                  </tr>
                ))
            ) : (
              <tr>
                <td
                  className='text-center'
                  colSpan='100%'
                >
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default App;
