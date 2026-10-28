import { useState } from 'react';
import {
  ConfirmActionDialog,
  type ConfirmActionDialogProps,
} from '@/components/ui/confirm-action-dialog';
import { Button } from '@/components/ui/button';
import { useStoryCopy } from './storybook';

export function ConfirmExample({
  failFirst = false,
  labels = {},
}: {
  failFirst?: boolean;
  labels?: Partial<ConfirmActionDialogProps>;
}) {
  const copy = useStoryCopy();
  const [open, setOpen] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [failed, setFailed] = useState(false);
  const [deleted, setDeleted] = useState(false);
  return (
    <div className="space-y-4">
      <Button variant="destructive" onClick={() => setOpen(true)}>
        {copy('삭제 확인 열기', 'Confirm deletion')}
      </Button>
      {deleted && <p role="status">{copy('예시 기록을 삭제했습니다.', 'Example note deleted.')}</p>}
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title={labels.title || copy('예시 기록을 삭제할까요?', 'Delete this example note?')}
        description={
          failed
            ? copy('삭제하지 못했습니다. 다시 시도해 주세요.', 'Deletion failed. Please try again.')
            : labels.description ||
              copy(
                '현재 예제의 임시 상태만 변경합니다.',
                'Only temporary example state will change.',
              )
        }
        cancelLabel={labels.cancelLabel || copy('취소', 'Cancel')}
        confirmLabel={labels.confirmLabel || copy('삭제하기', 'Delete')}
        loadingLabel={labels.loadingLabel || copy('삭제 중', 'Deleting')}
        onConfirm={async () => {
          setAttempts((n) => n + 1);
          await new Promise((resolve) => setTimeout(resolve, 400));
          if (failFirst && attempts === 0) {
            setFailed(true);
            throw new Error('Local example failure');
          }
          setFailed(false);
          setDeleted(true);
        }}
      />
    </div>
  );
}
