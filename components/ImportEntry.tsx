"use client";

import { useRef } from "react";

export default function ImportEntry() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="tw-import">
      <button type="button" onClick={() => dialog.current?.showModal()}>過去の発信を取り込む（X・note・日記）</button>
      <dialog ref={dialog} aria-labelledby="import-title" className="tw-dialog">
        <h2 id="import-title">過去の発信を取り込む</h2>
        <p>準備中。ハッカソン版では手書きの種を使っています。将来は X のアーカイブや note を取り込めます。</p>
        <form method="dialog"><button autoFocus>閉じる</button></form>
      </dialog>
    </div>
  );
}
