import React from 'react';
import { label } from '../utils/format';

export function Badge({ status, children }) {
  return <span className={`badge ${status || 'good'}`}>
    <i />{children || label(status)}
  </span>;
}
