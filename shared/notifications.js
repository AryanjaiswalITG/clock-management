// Notification message templates + category types, shared by the Express server
// and the browser mock so both backends emit identical copy. The UI groups/icons
// by `type`; the message is the human-readable line shown in the bell dropdown.

export const NOTIF_TYPES = {
  EMPLOYEE: "employee",
  LEAVE: "leave",
  TEAM: "team",
  COMPANY: "company",
};

// Keep the most recent N notifications per user (older ones are pruned on write).
export const NOTIF_KEEP = 50;

export const notifMsg = {
  // Admin-facing
  employeeJoined: (name) => `🎉 New employee joined: ${name} has joined your company.`,
  leaveSubmitted: (name) => `New leave request submitted by ${name}.`,
  leaveCancelled: (name) => `${name} cancelled a pending leave request.`,

  // Employee-facing
  leaveApproved: (comment) =>
    `Your leave request has been approved.${comment ? ` Note: ${comment}` : ""}`,
  leaveRejected: (comment) =>
    `Your leave request has been rejected.${comment ? ` Reason: ${comment}` : ""}`,
  departmentChanged: (dept) =>
    `Your department was updated${dept ? ` to ${dept}` : ""}.`,
  managerChanged: (mgr) =>
    `Your reporting manager was updated${mgr ? ` to ${mgr}` : ""}.`,
  roleChanged: (role) => `Your role was changed to ${role}.`,
  statusChanged: (status) => `Your account status was changed to ${status}.`,

  // Everyone
  companyRenamed: (name) => `Company name was changed to ${name}.`,
  policyUpdated: () => `The attendance policy was updated by an administrator.`,
};
