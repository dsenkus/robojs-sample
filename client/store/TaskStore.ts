import { observable, action, computed, flow } from 'mobx';
import { createTransformer } from 'mobx-utils';
import { IRootStore } from '.';
import * as api from '../api';
import { baseErrorHandler } from '../utils/errorHandler';
import { orderByCreatedAtAscending, orderByCreatedAtDescending } from '../utils/orderByCreatedAt';

export default class TaskStore {
  public rootStore: IRootStore

  @observable public tasks: Task[] = [];

  constructor(rootStore: IRootStore) {
    this.rootStore = rootStore;
  }

  @action public remove(id: string) {
    this.tasks = this.tasks.filter(item => item.id !== id);
  }

  @action public addToStore(task: Task) {
    // check if task already exists in store, update if it does
    if(this.tasks.some((t) => t.id === task.id)) {
      this.updateInStore(task);
    } else {
      this.tasks.push(task);
    }
  }

  @action public updateInStore(task: Task) {
    const index = this.tasks.findIndex(item => item.id === task.id);
    if(index > -1) {
      this.tasks[index] = task;
    }
  }

  /**
   * add Result to Task
   * @param result Result
   */
  @action public updateTaskResultInStore(result: Result) {
    const index = this.tasks.findIndex(item => item.id === result.task_id);
    if(index > -1) {
      this.tasks[index].result = result;
    }
  }

  @action public removeFromStore(id: string) {
    this.tasks = this.tasks.filter(item => item.id !== id);
  }

  /**
   * remove Result from Task
   * @param resultId result id
   */
  @action public removeTaskResultFromStore(resultId: string) {
    const index = this.tasks.findIndex(item => item.result && (item.result.id === resultId) || false);

    if(index > -1) {
      this.fetchOne(this.tasks[index].id);
    }
  }

  @action public runTask(id: string) {
     return this.update(id, { active: true });
  }

  @computed public get tasksWithError() {
    return this.tasks.filter(task => task.result && task.result.is_error === true) as TaskWithResult[];
  }

  @computed public get getTask() {
    return createTransformer((id: string) => {
      const results = this.tasks.filter(item => item.id === id);
      return results.length > 0 ? results[0] : null;
    });
  }

  @computed public get getTasksByCollectionId() {
    return createTransformer((colelctionId: string) => {
      return this.tasks.filter(item => item.collection_id === colelctionId);
    });
  }

  @computed public get tasksWithResult() {
    return this.tasks.filter(task => task.result !== undefined && task.result !== null); 
  }

  @computed get tasksSortedByLatestResultWithCollection(): TaskWithCollection[] {
    return this.tasksWithResult
      .sort(orderByCreatedAtDescending)
      .reduce<TaskWithCollection[]>((list, current) => {
        const collection = this.rootStore.collectionStore.getCollection(current.collection_id);

        if(collection) {
          list.push({
            ...current,
            collection
          });
        }

        return list;
    }, []);
  }

  public create = flow(function * create(this: TaskStore, data: CreateTaskData) {
    try {
      const response = yield api.createTask(data);
      const task = response.data as Task;
      this.addToStore(task);
      return task;
    } catch (error) {
      const jsonError = baseErrorHandler(error, this.rootStore);
      if(jsonError && jsonError.type === 'ValidationError') {
        throw error; // handle in react component
      } else if (jsonError) {
        this.rootStore.appNotificationStore.addFail(jsonError.message);
      }
      return null;
    }
  });

  public update = flow(function * update(this: TaskStore, id: string, data: UpdateTaskData) {
    try {
      const response = yield api.updateTask(id, data);
      const task = response.data as Task;
      this.updateInStore(task);
      return true;
    } catch (error) {
      const jsonError = baseErrorHandler(error, this.rootStore);
      if(jsonError && jsonError.type === 'ValidationError') {
        // handle in react component
        throw error; 
      } else if (jsonError) {
        this.rootStore.appNotificationStore.addFail(jsonError.message);
      }
      return false;
    }
  });

  public destroy = flow(function * destroy(this: TaskStore, task: Task) {
    try {
      yield api.deleteTask(task.id);
      this.removeFromStore(task.id);
      this.rootStore.appNotificationStore
        .addWarning(`Task "${task.name}" was succesfully deleted.`);
      return true;
    } catch (error) {
      const jsonError = baseErrorHandler(error, this.rootStore);
      if (jsonError) {
        this.rootStore.appNotificationStore.addFail(jsonError.message);
      }
      return false;
    }
  });

  public fetchAll = flow(function * fetchAll(this: TaskStore) {
    try {
      const result = yield api.getTasks();
      this.tasks = result.data;
    } catch (error) {
      this.tasks = [];
      const jsonError = baseErrorHandler(error, this.rootStore);
      if (jsonError) {
        this.rootStore.appNotificationStore.addFail(jsonError.message);
      }
    }
  });

  public fetchOne = flow(function * fetchAll(this: TaskStore, taskId: string) {
    try {
      const response = yield api.getTask(taskId);
      const task = response.data as Task;
      this.updateInStore(task);
    } catch (error) {
      this.tasks = [];
      const jsonError = baseErrorHandler(error, this.rootStore);
      if (jsonError) {
        this.rootStore.appNotificationStore.addFail(jsonError.message);
      }
    }
  });
}