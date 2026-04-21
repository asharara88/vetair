// Deterministic TypeScript compliance engine.
// No LLM. Rule-based. Evaluates a pet + documents against a country_rule.
// Called from the compliance-evaluate edge function and also bundled into the Next.js app.

export type RuleStatus = "satisfied" | "pending" | "blocked" | "not_applicable";

export interface Pet {
  id: string;
  species: string;
  breed?: string | null;
  date_of_birth?: string | null;
  microchip_id?: string | null;
  microchip_implant_date?: string | null;
  weight_kg?: number | null;
}

export interface DocumentRecord {
  id: string;
  document_type: string;
  extracted_fields: Record<string, unknown>;
  extraction_confidence?: number | null;
}

export interface CountryRule {
  id: string;
  requirement_code: string;
  requirement_type: string;
  evidence_schema: Record<string, unknown>;
  time_constraints: Record<string, unknown> | null;
  evaluator_fn_name: string | null;
  priority: number;
}

export interface CaseContext {
  id: string;
  origin_country: string;
  destination_country: string;
  target_date: string | null; // YYYY-MM-DD
}

export interface Evaluation {
  status: RuleStatus;
  confidence: number;
  notes: string;
  earliest_legal_date?: string | null;
  blocking_reason?: string | null;
  evidence_document_ids: string[];
}

const ok = (notes: string, evidenceIds: string[] = []): Evaluation => ({
  status: "satisfied",
  confidence: 1.0,
  notes,
  evidence_document_ids: evidenceIds,
});

const pending = (notes: string): Evaluation => ({
  status: "pending",
  confidence: 1.0,
  notes,
  evidence_document_ids: [],
});

const blocked = (
  reason: string,
  earliestLegal?: string,
): Evaluation => ({
  status: "blocked",
  confidence: 1.0,
  notes: reason,
  blocking_reason: reason,
  earliest_legal_date: earliestLegal ?? null,
  evidence_document_ids: [],
});

const na = (notes: string): Evaluation => ({
  status: "not_applicable",
  confidence: 1.0,
  notes,
  evidence_document_ids: [],
});

// ---------- helpers ----------

const daysBetween = (from: string | Date, to: string | Date): number => {
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
};

const addDays = (date: string | Date, days: number): string => {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const findDoc = (
  docs: DocumentRecord[],
  type: string,
): DocumentRecord | undefined => docs.find((d) => d.document_type === type);

// ---------- evaluators ----------

export const evalMicrochip = (
  pet: Pet,
  docs: DocumentRecord[],
  _rule: CountryRule,
  _case: CaseContext,
): Evaluation => {
  if (!pet.microchip_id) return pending("Microchip ID not yet provided");
  const id = String(pet.microchip_id).replace(/\s/g, "");
  if (!/^\d{15}$/.test(id)) {
    return blocked(
      `Microchip ID must be exactly 15 digits (ISO 11784/11785). Received: "${pet.microchip_id}"`,
    );
  }
  const doc = findDoc(docs, "microchip_cert") || findDoc(docs, "vaccination_record");
  const evidenceIds = doc ? [doc.id] : [];
  return ok(`Microchip ${id} validated (ISO 11784/11785, 15 digits)`, evidenceIds);
};

export const evalRabiesVaccine = (
  pet: Pet,
  docs: DocumentRecord[],
  rule: CountryRule,
  caseCtx: CaseContext,
): Evaluation => {
  const vaxDoc = findDoc(docs, "vaccination_record");
  if (!vaxDoc) return pending("Vaccination record not yet uploaded");

  const fields = vaxDoc.extracted_fields as Record<string, unknown>;
  const vaxDate = fields.rabies_vaccine_date as string | undefined;
  if (!vaxDate) return pending("Rabies vaccine date missing from uploaded document");

  const constraints = (rule.time_constraints ?? {}) as Record<string, number>;
  const minAgeWeeks = Number(constraints.min_age_at_vaccination_weeks ?? 12);

  if (pet.date_of_birth) {
    const ageAtVaxDays = daysBetween(pet.date_of_birth, vaxDate);
    if (ageAtVaxDays < minAgeWeeks * 7) {
      return blocked(
        `Pet was too young at vaccination. Rabies must be given at ${minAgeWeeks}+ weeks old; was ${Math.floor(ageAtVaxDays / 7)} weeks old on ${vaxDate}.`,
      );
    }
  }

  if (pet.microchip_implant_date) {
    if (new Date(pet.microchip_implant_date) > new Date(vaxDate)) {
      return blocked(
        `Rabies vaccine on ${vaxDate} predates microchip implant on ${pet.microchip_implant_date}. Vaccine must be administered AFTER microchip. Re-vaccination required.`,
      );
    }
  }

  return ok(
    `Rabies vaccine administered ${vaxDate} (after microchip, at valid age)`,
    [vaxDoc.id],
  );
};

export const evalWaitPeriod = (
  _pet: Pet,
  docs: DocumentRecord[],
  rule: CountryRule,
  caseCtx: CaseContext,
): Evaluation => {
  const vaxDoc = findDoc(docs, "vaccination_record");
  if (!vaxDoc) return pending("Rabies vaccine date needed to compute wait period");

  const vaxDate = (vaxDoc.extracted_fields as Record<string, unknown>)
    .rabies_vaccine_date as string | undefined;
  if (!vaxDate) return pending("Rabies vaccine date missing from uploaded document");

  const constraints = (rule.time_constraints ?? {}) as Record<string, number>;
  const waitDays = Number(constraints.wait_days_from_primary_vaccine ?? 21);
  const earliestLegal = addDays(vaxDate, waitDays);

  if (!caseCtx.target_date) {
    return pending(
      `Earliest legal entry date is ${earliestLegal}. Target date not yet confirmed.`,
    );
  }

  if (new Date(caseCtx.target_date) < new Date(earliestLegal)) {
    return blocked(
      `${waitDays}-day wait from primary rabies vaccine not satisfied. Earliest legal entry: ${earliestLegal} (target: ${caseCtx.target_date}).`,
      earliestLegal,
    );
  }

  return ok(
    `${waitDays}-day post-vaccine wait satisfied. Earliest legal entry was ${earliestLegal}.`,
    [vaxDoc.id],
  );
};

export const evalMinAge = (
  pet: Pet,
  _docs: DocumentRecord[],
  rule: CountryRule,
  caseCtx: CaseContext,
): Evaluation => {
  if (!pet.date_of_birth) return pending("Date of birth not yet provided");
  if (!caseCtx.target_date) return pending("Target travel date not yet set");

  const constraints = (rule.time_constraints ?? {}) as Record<string, number>;
  const minWeeks = Number(constraints.min_age_weeks_at_entry ?? 15);
  const ageDays = daysBetween(pet.date_of_birth, caseCtx.target_date);
  const ageWeeks = Math.floor(ageDays / 7);

  if (ageWeeks < minWeeks) {
    const needDate = addDays(pet.date_of_birth, minWeeks * 7);
    return blocked(
      `Minimum age at entry is ${minWeeks} weeks. Pet will be ${ageWeeks} weeks on ${caseCtx.target_date}. Earliest eligible: ${needDate}.`,
      needDate,
    );
  }

  return ok(`Age ${ageWeeks} weeks at target date ≥ minimum ${minWeeks} weeks`);
};

export const evalBreedRestriction = (
  pet: Pet,
  _docs: DocumentRecord[],
  rule: CountryRule,
  _case: CaseContext,
): Evaluation => {
  if (!pet.breed) return pending("Breed not yet provided");

  const schema = (rule.evidence_schema ?? {}) as Record<string, unknown>;
  const banned = (schema.banned_breeds as string[] | undefined) ?? [];

  const petBreedLower = pet.breed.toLowerCase();
  const hit = banned.find((b) => petBreedLower.includes(b.toLowerCase()));
  if (hit) {
    return blocked(
      `Breed "${pet.breed}" matches banned list entry "${hit}". Absolute ban — no exceptions. Re-homing or alternative destination required.`,
    );
  }

  return ok(`Breed "${pet.breed}" not on restricted list`);
};

export const evalHealthCert = (
  _pet: Pet,
  docs: DocumentRecord[],
  _rule: CountryRule,
  _case: CaseContext,
): Evaluation => {
  const doc = findDoc(docs, "health_certificate");
  if (!doc) return pending("Health certificate to be issued by OV within 10 days pre-travel");
  return ok("Health certificate uploaded", [doc.id]);
};

export const evalMoccaeExport = (
  _pet: Pet,
  docs: DocumentRecord[],
  _rule: CountryRule,
  _case: CaseContext,
): Evaluation => {
  const doc = findDoc(docs, "endorsement");
  if (!doc) return pending("MOCCAE export permit to be obtained (forward procedure)");
  return ok("MOCCAE export permit uploaded", [doc.id]);
};

export const evalMoccaeImportPermit = (
  _pet: Pet,
  docs: DocumentRecord[],
  _rule: CountryRule,
  _case: CaseContext,
): Evaluation => {
  const doc = findDoc(docs, "import_permit");
  if (!doc) return pending("MOCCAE import permit to be obtained before travel (forward procedure)");
  return ok("MOCCAE import permit uploaded", [doc.id]);
};

export const evalApprovedCarrier = (
  _pet: Pet,
  _docs: DocumentRecord[],
  _rule: CountryRule,
  _case: CaseContext,
): Evaluation =>
  pending("Airline selection is a forward procedure; will be locked during booking phase");

export const evalDHPP = (
  _pet: Pet,
  docs: DocumentRecord[],
  _rule: CountryRule,
  _case: CaseContext,
): Evaluation => {
  const vaxDoc = findDoc(docs, "vaccination_record");
  if (!vaxDoc) return pending("DHPP vaccination record not yet uploaded");
  const dhpp = (vaxDoc.extracted_fields as Record<string, unknown>).dhpp_vaccine_date;
  if (!dhpp) return pending("DHPP vaccine date not found on uploaded record");
  return ok(`DHPP vaccine on record (${dhpp})`, [vaxDoc.id]);
};

export const evalFVRCP = (
  _pet: Pet,
  docs: DocumentRecord[],
  _rule: CountryRule,
  _case: CaseContext,
): Evaluation => {
  const vaxDoc = findDoc(docs, "vaccination_record");
  if (!vaxDoc) return pending("FVRCP vaccination record not yet uploaded");
  const fvrcp = (vaxDoc.extracted_fields as Record<string, unknown>).fvrcp_vaccine_date;
  if (!fvrcp) return pending("FVRCP vaccine date not found on uploaded record");
  return ok(`FVRCP vaccine on record (${fvrcp})`, [vaxDoc.id]);
};

export const evalAlwaysSatisfied = (): Evaluation =>
  na("Requirement does not apply to this corridor");

// ---------- registry ----------

export type Evaluator = (
  pet: Pet,
  docs: DocumentRecord[],
  rule: CountryRule,
  caseCtx: CaseContext,
) => Evaluation;

export const EVALUATORS: Record<string, Evaluator> = {
  evalMicrochip,
  evalRabiesVaccine,
  evalWaitPeriod,
  evalMinAge,
  evalBreedRestriction,
  evalHealthCert,
  evalMoccaeExport,
  evalMoccaeImportPermit,
  evalApprovedCarrier,
  evalDHPP,
  evalFVRCP,
  evalAlwaysSatisfied,
};

export function evaluateRule(
  pet: Pet,
  docs: DocumentRecord[],
  rule: CountryRule,
  caseCtx: CaseContext,
): Evaluation {
  const fn = rule.evaluator_fn_name && EVALUATORS[rule.evaluator_fn_name];
  if (!fn) {
    return pending(
      `No deterministic evaluator registered for ${rule.requirement_code} (${rule.evaluator_fn_name ?? "unset"})`,
    );
  }
  return fn(pet, docs, rule, caseCtx);
}

export function evaluateAllRules(
  pet: Pet,
  docs: DocumentRecord[],
  rules: CountryRule[],
  caseCtx: CaseContext,
): Array<{ rule: CountryRule; evaluation: Evaluation }> {
  return rules.map((rule) => ({ rule, evaluation: evaluateRule(pet, docs, rule, caseCtx) }));
}

export function aggregateVerdict(
  results: Array<{ rule: CountryRule; evaluation: Evaluation }>,
): { verdict: "approved" | "blocked" | "pending"; earliest_legal_departure: string | null } {
  const blockedItems = results.filter((r) => r.evaluation.status === "blocked");
  if (blockedItems.length > 0) {
    const dates = blockedItems
      .map((r) => r.evaluation.earliest_legal_date)
      .filter((d): d is string => Boolean(d))
      .sort();
    return {
      verdict: "blocked",
      earliest_legal_departure: dates.length ? dates[dates.length - 1] : null,
    };
  }
  const hasPending = results.some((r) => r.evaluation.status === "pending");
  return {
    verdict: hasPending ? "pending" : "approved",
    earliest_legal_departure: null,
  };
}
