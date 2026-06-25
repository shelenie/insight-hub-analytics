# GLOSSARY.md

## Purpose

Project-specific terms for Internal Analytics Workspace.

---

## Workspace

Top-level environment where agency analytics data lives.

May contain users, clients, projects, funnels, sources, imports, dashboards, roles, and permissions.

---

## Client

A business/customer managed by the agency.

---

## Project

A business/marketing unit under a client.

Do not confuse with GitHub project/repository.

---

## Funnel

A marketing/sales path inside a project.

May include lead capture, booking, payment, CRM stage, and follow-up.

---

## Source

Origin of data: ad platform, sheet, CSV, CRM export, webhook, API, payment export, manual import.

---

## Raw Data

Original data from source.

Should be preserved where practical.

---

## Cleaned Data

Validated/transformed data prepared for use.

---

## Dashboard-Ready Data

Structured data safe enough for metrics, filters, charts, and reports.

---

## Mapping

Connecting source fields to target fields.

---

## Rejected Row

A row that could not be processed safely.

Do not silently discard rejected rows.

---

## User

A person who can access the workspace if they have valid auth and active membership.

---

## Auth User

Identity-level user, e.g. Supabase Auth user.

Auth user alone does not equal workspace access.

---

## App Profile

Application-level profile for display/preferences.

---

## Workspace Member

Connection between user and workspace with role/status.

---

## Role

Named access level such as superadmin, admin, member, viewer, client.

Actual roles must be verified in repo.

---

## Permission

Specific allowed action, e.g. view dashboard, manage sources, invite users, restore backups.

---

## RLS

Row Level Security. Critical for workspace isolation and access control.

---

## Edge Function

Supabase server-side function for secure backend logic.

---

## Service Role Key

Highly privileged key. Never expose in frontend or commit to repo.

---

## Metric Definition

Documented rule for calculating a metric: name, formula, source fields, date logic, filters, limitations.

---

## AI Insight

AI-generated explanation based on verified data.

Must not invent analytics.

---

## Audit Log

Record of important actions: who did what, when, target object, old/new values.
