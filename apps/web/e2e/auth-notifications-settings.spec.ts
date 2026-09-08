import { test, expect } from '@playwright/test';

test.describe('Enterprise Auth, Notification Center, and Topbar Settings Specs', () => {
  test('Login Page: Selects demo persona and redirects to authenticated workspace', async ({
    page,
  }) => {
    await page.goto('/#/login');
    await expect(page.locator('.brand-name')).toHaveText('AssessFlow');
    await expect(page.locator('.login-main-card h2')).toContainText('Welcome to AssessFlow');

    // Verify all 5 demo personas are rendered
    const cards = page.locator('.demo-persona-card');
    await expect(cards).toHaveCount(5);

    // Select Dr. Ahmed Mansour (Lead Assessor)
    const assessorCard = page.locator('.demo-persona-card').filter({ hasText: 'Dr. Ahmed Mansour' });
    await expect(assessorCard).toBeVisible();
    await assessorCard.click();

    // Verify active persona updated in Topbar and Home greeting
    await expect(page.locator('.brand-copy strong')).toHaveText('AssessFlow');
    const topbarProfile = page.locator('.topbar-profile');
    await expect(topbarProfile.locator('strong')).toHaveText('Dr. Ahmed Mansour');
    await expect(topbarProfile.locator('small')).toHaveText('Principal Assessor & Lead');
    await expect(page.locator('h1')).toContainText('Good morning, Dr. Ahmed');
  });

  test('Navbar Settings Icon: Opens telemetry dialog with PostgreSQL status and allows preferences toggle', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('.brand-copy strong')).toHaveText('AssessFlow');

    // Click Settings icon in topbar
    const settingsBtn = page.locator('.settings-button');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Verify Settings dialog opens
    const dialog = page.locator('.settings-dialog-card');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('System & Workspace Settings')).toBeVisible();
    await expect(dialog.getByText('PostgreSQL 18.x')).toBeVisible();
    await expect(dialog.getByText('asses_db')).toBeVisible();

    // Switch to Preferences tab and toggle sound
    await dialog.getByRole('tab', { name: /Preferences/i }).click();
    const soundToggle = dialog.getByLabel('Toggle sound');
    await expect(soundToggle).toBeVisible();
    await soundToggle.click();

    // Close dialog
    await dialog.getByRole('button', { name: /Done/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('Notification Popover & Center: Bell icon opens tray and navigates to Notification Center', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('.brand-copy strong')).toHaveText('AssessFlow');

    // Click Bell icon in topbar
    const bellBtn = page.locator('.notification-button');
    await expect(bellBtn).toBeVisible();
    await bellBtn.click();

    // Notification tray popover appears
    const tray = page.locator('.notification-popover-tray');
    await expect(tray).toBeVisible();
    await expect(tray.locator('.notif-header-title strong')).toHaveText('Notifications');

    // Click link to open full notification center
    await tray.getByRole('button', { name: /Open full Notification Center/i }).click();
    await expect(page).toHaveURL(/#\/notifications/);
    await expect(page.locator('h1')).toHaveText('Notification Center');
    await expect(page.getByRole('button', { name: /All Alerts/i })).toBeVisible();
  });

  test('Topbar Persona Quick Switcher: 1-click switches demo test user', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.brand-copy strong')).toHaveText('AssessFlow');

    // Click user profile pill in topbar
    const profileBtn = page.locator('.topbar-profile-interactive');
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    // Persona dropdown appears
    const dropdown = page.locator('.persona-dropdown-menu');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByText('Quick Select Persona')).toBeVisible();

    // Switch to Mona Zaki (Talent Development Lead)
    const monaBtn = dropdown.locator('.persona-item-btn').filter({ hasText: 'Mona Zaki' });
    await expect(monaBtn).toBeVisible();
    await monaBtn.click();

    // Verify dropdown closes and Topbar updates
    await expect(dropdown).not.toBeVisible();
    await expect(page.locator('.topbar-profile strong')).toHaveText('Mona Zaki');
    await expect(page.locator('.topbar-profile small')).toHaveText('Talent & Leadership Development Lead');
  });
});
