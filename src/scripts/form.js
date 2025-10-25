const form = document.querySelector('#quote-form');
const statusRegion = document.querySelector('[data-form-status]');

const setStatus = (message, isError = false) => {
  if (!statusRegion) return;
  statusRegion.textContent = message;
  statusRegion.classList.toggle('error', isError);
};

const validateForm = () => {
  if (!form) return false;
  const requiredFields = ['name', 'email', 'phone', 'flyerSize', 'quantity', 'suburbs', 'consent'];
  const errors = [];

  requiredFields.forEach((name) => {
    const field = form.elements.namedItem(name);
    if (!field) return;
    if (field.type === 'checkbox') {
      if (!field.checked) {
        errors.push('Please confirm consent to be contacted.');
      }
      return;
    }
    if (!field.value.trim()) {
      errors.push(`Field "${field.getAttribute('aria-label') || name}" is required.`);
    }
  });

  const emailField = form.elements.namedItem('email');
  if (emailField && emailField.value) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailField.value)) {
      errors.push('Please enter a valid email address.');
    }
  }

  const phoneField = form.elements.namedItem('phone');
  if (phoneField && phoneField.value) {
    const phonePattern = /^[0-9\s()+-]{6,}$/;
    if (!phonePattern.test(phoneField.value)) {
      errors.push('Please enter a valid phone number.');
    }
  }

  if (errors.length > 0) {
    setStatus(errors[0], true);
    return false;
  }

  setStatus('');
  return true;
};

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton?.setAttribute('disabled', 'true');
    setStatus('Sending your request…');

    try {
      const formData = new FormData(form);
      const response = await fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json'
        }
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Unable to send your request.');
      }

      setStatus('Thanks! Your quote request is on its way.', false);
      form.reset();
    } catch (error) {
      console.error(error);
      setStatus('Sorry, something went wrong. Please call us on (08) 9000 0000.', true);
    } finally {
      submitButton?.removeAttribute('disabled');
    }
  });
}
