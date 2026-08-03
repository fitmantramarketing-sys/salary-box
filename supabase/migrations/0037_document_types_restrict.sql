alter table employee_documents
  drop constraint if exists employee_documents_type_check;

alter table employee_documents
  add constraint employee_documents_type_check check (
    document_type in ('aadhar', 'pan', 'passport_photo')
  );
