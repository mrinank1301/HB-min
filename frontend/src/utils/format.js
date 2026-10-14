export const money = (value) => `${Number(value || 0).toFixed(1)} min`;
export const label = (status) => status === 'good' ? 'Healthy' : status === 'warning' ? 'Warning' : 'Critical';
