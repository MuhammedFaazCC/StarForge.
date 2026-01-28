
        function copyReferralLink() {
            const linkInput = document.getElementById('referralLink');
            linkInput.select();
            linkInput.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(linkInput.value).then(() => {
                showToast('Referral link copied to clipboard!');
            });
        }

        function copyReferralCode() {
            const codeInput = document.getElementById('referralCode');
            codeInput.select();
            codeInput.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(codeInput.value).then(() => {
                showToast('Referral code copied to clipboard!');
            });
        }

        function showToast(message) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: message,
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        }