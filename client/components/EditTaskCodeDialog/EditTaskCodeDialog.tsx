import React, { useState, FunctionComponent, useContext } from 'react';
import classNames from 'classnames';
import { Button, Classes, Dialog, Intent, Spinner } from '@blueprintjs/core';
import AceEditor from 'react-ace';
import 'brace/mode/javascript';
import 'brace/theme/github';
import { runCode } from '../../api';
import { observer } from 'mobx-react-lite';
import { StoreContext } from '../../providers';
import { useForm } from '../../utils/useForm';
import CodeTemplateDialog from '../CodeTemplateDialog/CodeTemplateDialog';
import { baseErrorHandler } from '../../utils/errorHandler';

interface Props {
  open: boolean
  onClose: () => void
  task: Task
}

const EditTaskCodeDialog: FunctionComponent<Props> = observer(({ task, open, onClose }) => {
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [code, setCode] = useState(task.code);
  const [loadingRun, setLoadingRun] = useState(false);
  const [result, setResult] = useState<any>(null);
  const rootStore = useContext(StoreContext);
  const { appNotificationStore, taskStore, configStore } = rootStore;
  const { isMobile } = configStore;

  const handleRun = async () => {
    setLoadingRun(true);

    try {
      const { data } = await runCode(code, task.id);
      setResult(data);
    } catch (error) {
      const jsonError = baseErrorHandler(error, rootStore);
      if(jsonError) {
        appNotificationStore.addFail(jsonError.message);
      }
    }

    setLoadingRun(false);
  }

  const { loading: loadingSave, error: saveError, submitHandler: handleSave } = useForm(async () => {
    if(await taskStore.update(task.id, { code })) {
      onClose();
    }
  })

  return (
    <div className="EditTaskCodeDialog">
      <Dialog 
        title={`${task.name} Code`} 
        canEscapeKeyClose={false}
        canOutsideClickClose={false}
        onClose={onClose} 
        style={{
          maxWidth: '1000px',
          width: isMobile ? '100%' : '80%',
        }}
        isOpen={open}>
        <form onSubmit={handleSave}>
          <div className="mb3 bb bt b--light-gray">
            <AceEditor
              value={code}
              mode="javascript"
              theme="github"
              tabSize={2}
              fontSize={isMobile ? 12 : 14}
              onChange={setCode}
              width="auto"
              height={isMobile ? '300px' : '500px'}
              name="UNIQUE_ID_OF_DIV"
              setOptions={{
                showGutter: !isMobile,
                showPrintMargin: false,
                showLineNumbers: !isMobile,
              }}
              onLoad={(editor: any) => {
                // allow omitting semicolons
                editor.session.$worker.send('changeOptions', [{asi: true}])
              }}
              editorProps={{ $blockScrolling: true, }}
            />

            {loadingRun && <div className="ma4"><Spinner/></div>}

            {!loadingRun && result &&
              <div className="ma3">
                <h4 className="ma0 mb1">RESULT</h4>
                <code className={classNames('code', 'code--result', {'code--error': result.is_error})}>
                  {result.result}
                </code>

                <h4 className="ma0 mb1 mt3">NOTIFICATION</h4>
                <code className={classNames('code', 'code--notification')}>
                  {result.notification}
                </code>
              </div>}
          </div>

          <CodeTemplateDialog
            open={openTemplateDialog} 
            onClose={() => setOpenTemplateDialog(false)} 
            onSubmit={setCode} />

          {saveError && saveError.data.code && 
            <div className="error-box mb3 mh3">{saveError.data.code}</div>}

          <div className={Classes.DIALOG_FOOTER}>
            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
              <Button
                onClick={() => setOpenTemplateDialog(true)}
                minimal={true}
                intent={Intent.PRIMARY}
                style={{marginLeft: 0}}
                text="Use template"/>
              <div className="fg1"/>
              <Button onClick={handleRun}>Run Code</Button>
              <Button loading={loadingSave} type="submit" intent={Intent.PRIMARY}>Save Code</Button>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  )
});

export default EditTaskCodeDialog;