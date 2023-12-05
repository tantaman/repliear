import ReactDOM from 'react-dom/client';
import './index.css';
import {mutators} from './model/mutators';
import {Replicache} from 'replicache';
import {UndoManager} from '@rocicorp/undo';
import App from './app';
import {lock} from './util/sync-lock';

async function init() {
  // See https://doc.replicache.dev/licensing for how to get a license key.
  const licenseKey = import.meta.env.VITE_REPLICACHE_LICENSE_KEY;
  if (!licenseKey) {
    throw new Error('Missing VITE_REPLICACHE_LICENSE_KEY');
  }

  const syncLock = lock('pull');
  const r = new Replicache({
    name: 'anon',
    licenseKey,
    mutators,
    logLevel: 'debug',
    puller: async requestBody => {
      if (!syncLock.held) {
        return {
          httpRequestInfo: {
            errorMessage: 'Tab does not hold the pull lock',
            httpStatusCode: 400,
          },
        };
      }
      const res = await fetch('/api/replicache/pull', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(requestBody),
      });
      return {
        response: await res.json(),
        httpRequestInfo: {
          errorMessage: !res.ok ? res.statusText : '',
          httpStatusCode: res.status,
        },
      };
    },
    pushURL: `/api/replicache/push`,
    pullURL: `/api/replicache/pull`,
  });
  const undoManager = new UndoManager();

  function Root() {
    return (
      <div className="repliear">
        <App rep={r} undoManager={undoManager} />
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <Root />,
  );

  // Issue a pull whenever we become leader.
  syncLock.onStatusChange(async held => {
    if (held) {
      console.log('status change?');
      await r.pull();
    }
  });
}

await init();
