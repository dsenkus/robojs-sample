import React, { useState, useContext, FunctionComponent } from 'react';
import { FormGroup, Classes, InputGroup, HTMLSelect, TextArea, Button, Intent } from '@blueprintjs/core';
import { useForm } from '../../utils/useForm';
import { StoreContext } from '../../providers';
import getAllowedTaskIntervals from '../../utils/getAllowedTaskIntervals';
import { useMounted } from '../../utils/useMounted';

interface Props {
  task: Task
  handleClose: () => any
}

// TODO: check if intervals list is changed when user.role changes (plan downgrade)

const EditTaskForm: FunctionComponent<Props> = ({ handleClose, task }) => {
  const { authStore, collectionStore, taskStore } = useContext(StoreContext);
  const { user } = authStore;

  const [name, setName] = useState(task.name);
  const [collectionId, setCollectionId] = useState(task.collection_id);
  const [interval, setInterval] = useState<number>(task.interval);
  const [description, setDescription] = useState(task.description);

  const mounted = useMounted();

  const { loading, error, submitHandler } = useForm(async () => {
    if(await taskStore.update(task.id, { name, description, interval, collection_id: collectionId }) && mounted.current) {
      handleClose();
    }
  })

  // colection options for <select>
  const collections = collectionStore.collections.map(collection => ({
    label: collection.name,
    value: collection.id,
  }));

  return (
    <form onSubmit={submitHandler}>
      <div className={Classes.DIALOG_BODY}>
        <FormGroup 
          intent={error && error.data.name ? 'danger' : 'none'}
          helperText={error && error.data.name}
          label="Name" 
          labelInfo="(required)">
          <InputGroup
            value={name}
            disabled={loading}
            onChange={(e: any) => setName(e.target.value)} 
            />
        </FormGroup>

        <FormGroup 
          intent={error && error.data.collection_id ? 'danger' : 'none'}
          helperText={error && error.data.collection_id}
          label="Collection"
          labelInfo="(required)">
          <HTMLSelect
            value={collectionId}
            disabled={loading}
            options={collections}
            fill={true}
            onChange={(e) => setCollectionId(e.target.value)}
          />
        </FormGroup>

        <FormGroup 
          intent={error && error.data.interval ? 'danger' : 'none'}
          helperText={error && error.data.interval}
          label="Schedule Interval"
          labelInfo="(required)">
          <HTMLSelect
            value={interval}
            disabled={loading}
            options={getAllowedTaskIntervals(user.role)}
            fill={true}
            onChange={(e: any) => setInterval(parseInt(e.target.value))}
          />
        </FormGroup>
      
        <FormGroup 
          intent={error && error.data.description ? 'danger' : 'none'}
          helperText={error && error.data.description}
          label="Description" >
          <TextArea
            value={description}
            disabled={loading}
            fill={true} 
            onChange={(e: any) => setDescription(e.target.value)} />
        </FormGroup>
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={handleClose}>Close</Button>
          <Button type="submit" intent={Intent.PRIMARY} loading={loading}>Update Task</Button>
        </div>
      </div>
    </form>
  );
}

export default EditTaskForm;