import Swal from 'sweetalert2';

const baseConfig = {
    background: '#1e293b',
    color: '#e2e8f0',
    confirmButtonColor: '#6366f1',
    cancelButtonColor: '#334155',
    customClass: {
        popup: 'swal-dark',
        confirmButton: 'swal2-confirm',
        cancelButton: 'swal2-cancel',
    },
};

export const toast = (icon, title, timer = 3000) =>
    Swal.fire({
        ...baseConfig,
        position: 'center',
        icon,
        title,
        timer,
        timerProgressBar: true,
        showConfirmButton: false,
        showCloseButton: false,
    });

export const alert = (icon, title, text) =>
    Swal.fire({ ...baseConfig, icon, title, text });

export const confirm = (title, text, confirmText = 'Yes') =>
    Swal.fire({
        ...baseConfig,
        title,
        text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Cancel',
    });

export const loader = (title = 'Loading...') =>
    Swal.fire({
        ...baseConfig,
        title,
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
    });

export const closeLoader = () => Swal.close();

export default { toast, alert, confirm, loader, closeLoader };
