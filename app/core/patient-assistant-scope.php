<?php

function patient_assistant_in_scope($question)
{
    $query = trim((string) $question);
    // Greetings are allowed; standalone language requests receive the English scope reminder.
    if (preg_match('/^(?:hello|hi|hey|hoy|help|thanks|thank you|salamat|kumusta|kamusta|maayong (?:buntag|adlaw|hapon|gabii)|good (?:morning|afternoon|evening))[\s!?.]*$/iu', $query)) {
        return true;
    }
    // Require a supported topic in the current message, not just in old chat history.
    return (bool) preg_match('/\b(?:hospital|clinic|clinical|portal|laboratory|lab|patient|doctor|nurse|medical|health|result|results|report|reports|test|tests|request|requests|order|orders|status|sample|specimen|blood|urine|cbc|hba1c|glucose|cholesterol|urinalysis|appointment|facility|facilities|notification|notifications|download|print|pdf|profile|account|login|password|email|phone|contact|diagnosis|diagnose|medicine|medication|treatment|symptom|symptoms|pain|bleeding|emergency|suicide|suicidal|ospital|klinika|pasyente|doktor|nars|laboratorio|laboratoryo|resulta|dugo|ihi|tambal|gamot|sakit|hilanat|lagnat|reseta|konsulta)\b|\b(?:cannot breathe|can.t breathe|lisod ginhawa|hirap huminga)\b/iu', $query);
}
