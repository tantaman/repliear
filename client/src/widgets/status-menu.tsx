import React, {memo, MouseEvent, RefObject, useRef, useState} from 'react';
import {usePopper} from 'react-popper';
import StatusIcon from './status-icon';
import CancelIcon from '../assets/icons/cancel.svg?react';
import BacklogIcon from '../assets/icons/circle-dot.svg?react';
import TodoIcon from '../assets/icons/circle.svg?react';
import DoneIcon from '../assets/icons/done.svg?react';
import InProgressIcon from '../assets/icons/half-circle.svg?react';
import {useClickOutside} from '../hooks/useClickOutside';
import {Status} from 'shared';

interface Props {
  labelVisible?: boolean;
  onSelect: (status: Status) => void;
  status: Status;
}

export const statuses = [
  [BacklogIcon, 'BACKLOG', 'Backlog'],
  [TodoIcon, 'TODO', 'Todo'],
  [InProgressIcon, 'IN_PROGRESS', 'In Progress'],
  [DoneIcon, 'DONE', 'Done'],
  [CancelIcon, 'CANCELED', 'Canceled'],
] as const;

const getStatusString = (status: Status) => {
  switch (status) {
    case 'BACKLOG':
      return 'Backlog';
    case 'TODO':
      return 'Todo';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'DONE':
      return 'Done';
    case 'CANCELED':
      return 'Canceled';
    default:
      return 'Backlog';
  }
};

const StatusMenu = ({labelVisible = false, onSelect, status}: Props) => {
  const [buttonRef, setButtonRef] = useState<HTMLButtonElement | null>(null);
  const [statusDropDownVisible, setStatusDropDownVisible] = useState(false);

  const ref = useRef<HTMLDivElement>() as RefObject<HTMLDivElement>;

  const handleDropdownClick = (e: MouseEvent) => {
    e.stopPropagation();
    setStatusDropDownVisible(!statusDropDownVisible);
  };

  useClickOutside(ref, () => {
    if (statusDropDownVisible) {
      setStatusDropDownVisible(false);
    }
  });

  const options = statuses.map(([Icon, status, label], idx) => {
    return (
      <div
        key={idx}
        className="flex items-center h-8 px-3 text-gray focus:outline-none hover:text-gray-800 hover:bg-gray-300"
        onClick={(e: MouseEvent) => {
          onSelect(status);
          setStatusDropDownVisible(false);
          e.stopPropagation();
        }}
      >
        <Icon className="mr-3" />
        <span>{label}</span>
      </div>
    );
  });

  return (
    <div ref={ref}>
      <button
        className="inline-flex items-center h-6 px-2 border-none rounded focus:outline-none hover:bg-gray-850"
        ref={setButtonRef}
        onClick={handleDropdownClick}
      >
        <StatusIcon status={status} />
        {labelVisible && (
          <div className="ml-2 whitespace-nowrap">
            {getStatusString(status)}
          </div>
        )}
      </button>
      {statusDropDownVisible && (
        <Popper buttonRef={buttonRef}>{options}</Popper>
      )}
    </div>
  );
};

const Popper = ({
  buttonRef,
  children,
}: {
  buttonRef: HTMLButtonElement | null;
  children: React.ReactNode;
}) => {
  const [popperRef, setPopperRef] = useState<HTMLDivElement | null>(null);

  const {styles, attributes} = usePopper(buttonRef, popperRef, {
    placement: 'bottom-start',
  });

  return (
    <div
      ref={setPopperRef}
      style={{
        ...styles.popper,
      }}
      {...attributes.popper}
      className="cursor-default bg-white rounded shadow-modal z-100 w-34"
    >
      <div style={styles.offset}>{children}</div>
    </div>
  );
};

export default memo(StatusMenu);
