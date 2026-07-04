import * as yup from 'yup';

export const createGuestSchema = yup.object().shape({
  first_name: yup.string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name too long')
    .required('First name is required'),
  last_name: yup.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name too long')
    .required('Last name is required'),
  email: yup.string()
    .email('Invalid email address')
    .optional(),
  phone: yup.string()
    .optional(),
  nationality: yup.string()
    .optional(),
  document_type: yup.string()
    .oneOf(['', 'passport', 'national_id', 'drivers_license'], 'Invalid document type')
    .optional(),
  document_number: yup.string()
    .optional(),
  date_of_birth: yup.date()
    .typeError('Invalid date')
    .max(new Date(), 'Date of birth cannot be in the future')
    .nullable()
    .optional(),
  gender: yup.string()
    .oneOf(['', 'male', 'female', 'other'], 'Invalid gender')
    .optional(),
  notes: yup.string()
    .max(500, 'Notes must be 500 characters or less')
    .optional(),
  place_of_birth: yup.string()
    .max(100, 'Place of birth too long')
    .optional(),
  country_of_birth: yup.string()
    .max(100, 'Country of birth too long')
    .optional(),
  place_of_residence: yup.string()
    .optional(),
  country_of_residence: yup.string()
    .optional(),
  document_expiry: yup.date()
    .typeError('Invalid date')
    .nullable()
    .optional(),
  document_issued_place: yup.string()
    .optional(),
  document_issued_date: yup.date()
    .typeError('Invalid date')
    .nullable()
    .optional(),
  jmbg: yup.string()
    .optional(),
  unique_master_citizen: yup.string()
    .optional(),
});

export const updateGuestSchema = yup.object().shape({
  first_name: yup.string()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name too long'),
  last_name: yup.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100, 'Last name too long'),
  email: yup.string()
    .email('Invalid email address'),
  phone: yup.string(),
  nationality: yup.string(),
  document_type: yup.string()
    .oneOf(['', 'passport', 'national_id', 'drivers_license']),
  document_number: yup.string(),
  date_of_birth: yup.date()
    .typeError('Invalid date')
    .max(new Date(), 'Date of birth cannot be in the future')
    .nullable(),
  gender: yup.string()
    .oneOf(['', 'male', 'female', 'other']),
  notes: yup.string()
    .max(500, 'Notes must be 500 characters or less'),
  place_of_birth: yup.string()
    .max(100, 'Place of birth too long'),
  country_of_birth: yup.string()
    .max(100, 'Country of birth too long'),
  place_of_residence: yup.string(),
  country_of_residence: yup.string(),
  document_expiry: yup.date()
    .typeError('Invalid date')
    .nullable(),
  document_issued_place: yup.string(),
  document_issued_date: yup.date()
    .typeError('Invalid date')
    .nullable(),
  jmbg: yup.string(),
  unique_master_citizen: yup.string(),
});

export type CreateGuestInput = yup.InferType<typeof createGuestSchema>;
export type UpdateGuestInput = yup.InferType<typeof updateGuestSchema>;
