# Doctor and Laboratory Staff Roles

The system uses two separate hospital staff roles. Each role has its own account type, profile, dashboard, navigation, permissions, and responsibilities.

## Doctor

Doctors use the clinical workspace to:

- View authorized patients
- View available facilities and laboratory tests
- Submit new laboratory requests
- Track laboratory requests they submitted
- Review authorized results
- Add clinical notes to their patients' results
- Receive request and result notifications
- Manage their doctor profile and security settings

Doctor profiles store a specialty, professional license number, and assigned facility.

## Laboratory Staff

Laboratory Staff use the laboratory workspace to:

- View requests assigned to their facilities
- Accept requests and manage specimen-processing status
- Monitor the laboratory queue
- Upload result values and attachments
- Review, verify, reject, and release results
- View assigned facilities and operational workload
- Receive laboratory workflow notifications
- Manage their staff profile and security settings

Laboratory Staff profiles store an employee number, department, and default facility. Additional facilities can be assigned through `staff_facilities`.

## Workflow

1. A Doctor submits a laboratory request for an authorized patient.
2. Laboratory Staff receives the request and manages intake and specimen collection.
3. Laboratory Staff processes the request and uploads the result.
4. Laboratory Staff verifies and releases the result.
5. The Doctor reviews the result and may add a clinical note.
6. The Patient can view released results linked to their account.

## Access Rules

- Doctors only access patients and requests within their clinical scope.
- Laboratory Staff only access requests and results for assigned facilities.
- Patients only access their own requests and released results.
- Admin manages both user roles independently.
- Audit records identify the Doctor or Laboratory Staff member responsible for each action.

## Application Routes

Doctor pages are stored in `public/doctor/` and Doctor API wrappers are stored in `api/doctor/`.

Laboratory Staff pages are stored in `public/laboratory/` and Laboratory Staff API wrappers are stored in `api/laboratory/`.

The portable database installer creates separate `Doctor` and `Laboratory Staff` roles, plus the `doctors` and `laboratory_staff` profile tables.
