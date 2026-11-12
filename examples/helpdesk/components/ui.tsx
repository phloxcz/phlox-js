// Small pieces used on more screens: an avatar, the badge of a priority and of a state.
import type { Child } from 'phlox-js';
import type { Priority, Status, UserResource } from '../api';
import { PRIORITY, STATUS, initials } from '../format';
import { Icon } from './Icon';

/** Initials in a circle of the colour of the user; the photo of the design is not available. */
export function Avatar(props: { user: UserResource | undefined; size?: 'small' | 'large' }): Child {
  const name = props.user?.name ?? 'Nepřiřazeno';
  return (
    <span
      class={`hd-avatar ${props.size ? `hd-avatar-${props.size}` : ''}`}
      style={{ background: props.user?.color ?? '#94a3b8' }}
      title={name}
      role="img"
      aria-label={name}
    >
      {props.user ? initials(props.user.name) : '?'}
    </span>
  );
}

export function PriorityBadge(props: { priority: Priority; large?: boolean }): Child {
  return (
    <span class={`hd-priority hd-priority-${props.priority} ${props.large ? 'hd-priority-large' : ''}`}>
      {props.large ? <Icon name="alert" size={15} /> : null}
      {props.large ? `${PRIORITY[props.priority]} priorita` : PRIORITY[props.priority]}
    </span>
  );
}

/** A coloured dot of a state, before its name. */
export function StatusDot(props: { status: Status }): Child {
  return <span class={`hd-status-dot hd-status-${props.status}`} aria-hidden="true" />;
}

export function StatusLabel(props: { status: Status }): Child {
  return <span class="hd-status-label"><StatusDot status={props.status} />{STATUS[props.status]}</span>;
}
