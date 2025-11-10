const getEmailAddress = (user: string, domain: string) => `${user}@${domain}`;

const revealEmailLink = (container: HTMLElement, address: string) => {
  const link = container.querySelector('[data-email-link]');
  const button = container.querySelector('[data-email-reveal]');

  if (link instanceof HTMLAnchorElement) {
    link.href = `mailto:${address}`;
    link.textContent = address;
    link.removeAttribute('hidden');
  }

  if (button instanceof HTMLButtonElement) {
    button.hidden = true;
    button.setAttribute('aria-hidden', 'true');
  }
};

const attachClipboardFallback = (container: HTMLElement, address: string) => {
  const button = container.querySelector('[data-email-reveal]');
  if (!(button instanceof HTMLButtonElement)) return;

  button.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(address);
        button.textContent = 'Copied to clipboard';
      } else {
        button.textContent = address;
      }
    } catch {
      button.textContent = address;
    }
  });
};

export const initEmailObfuscator = (root: ParentNode = document) => {
  const containers = root.querySelectorAll<HTMLElement>(
    '[data-email-obfuscator]'
  );
  containers.forEach((container) => {
    const link = container.querySelector('[data-email-link]');
    const button = container.querySelector('[data-email-reveal]');
    const user =
      (link instanceof HTMLElement && link.dataset.user) ||
      (button instanceof HTMLElement && button.dataset.user) ||
      '';
    const domain =
      (link instanceof HTMLElement && link.dataset.domain) ||
      (button instanceof HTMLElement && button.dataset.domain) ||
      '';

    if (!user || !domain) return;
    const address = getEmailAddress(user, domain);
    attachClipboardFallback(container, address);
    revealEmailLink(container, address);
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initEmailObfuscator();
  });
}

export default initEmailObfuscator;
