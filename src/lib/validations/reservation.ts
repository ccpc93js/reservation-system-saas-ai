import * as yup from 'yup';

const getTodayLocalDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const createReservationSchema = yup.object().shape({
  guest_id: yup.string()
    .test('valid-guest-id', 'Invalid guest ID', function(value) {
      if (!value) return true;
      if (value === 'new') return true;
      return uuidRegex.test(value);
    }),
  first_name: yup.string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name too long')
    .required('First name is required'),
  last_name: yup.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name too long')
    .required('Last name is required'),
  check_in: yup.string()
    .required('Check-in date is required')
    .test('valid-date', 'Invalid check-in date', function(value) {
      return !isNaN(Date.parse(value));
    })
    .test('not-past', 'Check-in cannot be in the past', function(value) {
      if (!value) return false;
      return value >= getTodayLocalDateStr();
    }),
  check_out: yup.string()
    .required('Check-out date is required')
    .test('valid-date', 'Invalid check-out date', function(value) {
      return !isNaN(Date.parse(value));
    })
    .test('not-past', 'Check-out cannot be in the past', function(value) {
      if (!value) return false;
      return value >= getTodayLocalDateStr();
    }),
  price_per_night: yup.number()
    .typeError('Price must be a number')
    .positive('Price must be greater than 0')
    .required('Price per night is required'),
  notes: yup.string()
    .max(500, 'Notes must be 500 characters or less'),
  bed_id: yup.string()
    .required('Bed ID is required')
    .test('valid-uuid', 'Invalid bed ID', function(value) {
      return uuidRegex.test(value);
    }),
  org_id: yup.string()
    .required('Organization ID is required')
    .test('valid-uuid', 'Invalid organization ID', function(value) {
      return uuidRegex.test(value);
    }),
}).test('checkout-after-checkin', 'Check-out date must be after check-in date', function(value) {
  const { check_in, check_out } = value;
  if (!check_in || !check_out) return true;
  return new Date(check_out) > new Date(check_in);
});

export const updateReservationSchema = yup.object().shape({
  status: yup.string()
    .oneOf(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'])
    .required('Status is required'),
  check_out: yup.string()
    .test('valid-date', 'Invalid date', function(value) {
      if (!value) return true;
      return !isNaN(Date.parse(value));
    }),
  notes: yup.string()
    .max(500, 'Notes must be 500 characters or less'),
});

export type CreateReservationInput = yup.InferType<typeof createReservationSchema>;
export type UpdateReservationInput = yup.InferType<typeof updateReservationSchema>;
