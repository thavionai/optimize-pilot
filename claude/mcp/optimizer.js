"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/optimizer.ts
var optimizer_exports = {};
__export(optimizer_exports, {
  DEFAULT_DOCUMENT_OPTIONS: () => DEFAULT_DOCUMENT_OPTIONS,
  DEFAULT_OPTIONS: () => DEFAULT_OPTIONS,
  DEFAULT_OUTPUT_OPTIONS: () => DEFAULT_OUTPUT_OPTIONS,
  compileCustomRules: () => compileCustomRules,
  compressDocument: () => compressDocument,
  compressOutput: () => compressOutput,
  detectProfile: () => detectProfile,
  discover: () => discover,
  estimateTokens: () => estimateTokens,
  optimizeCommandOutput: () => optimizeCommandOutput,
  optimizePrompt: () => optimizePrompt
});
module.exports = __toCommonJS(optimizer_exports);
var DEFAULT_OPTIONS = {
  collapseWhitespace: true,
  removeFillerWords: true,
  simplifyVerbosePhrases: true,
  contractions: true
};
var VERBOSE_PHRASES = [
  // purpose
  [/\bin order to\b/gi, "to"],
  [/\bso as to\b/gi, "to"],
  [/\bfor the purpose of\b/gi, "for"],
  // causation ("...the fact that" specifics first)
  [/\bdue to the fact that\b/gi, "because"],
  [/\bowing to the fact that\b/gi, "because"],
  [/\bin view of the fact that\b/gi, "because"],
  [/\bin light of the fact that\b/gi, "because"],
  [/\bby virtue of the fact that\b/gi, "because"],
  [/\bon the grounds that\b/gi, "because"],
  [/\bfor the reason that\b/gi, "because"],
  [/\bgiven the fact that\b/gi, "since"],
  // concession
  [/\b(?:in spite|despite) of the fact that\b/gi, "although"],
  [/\bregardless of the fact that\b/gi, "although"],
  // condition
  [/\bin the event that\b/gi, "if"],
  [/\bon the off chance that\b/gi, "if"],
  // reference / relation
  [/\bwith (?:regard|regards|respect) to\b/gi, "regarding"],
  [/\bwith reference to\b/gi, "regarding"],
  [/\bin relation to\b/gi, "regarding"],
  [/\bin connection with\b/gi, "regarding"],
  [/\bwhen it comes to\b/gi, "for"],
  // instrument / accompaniment
  [/\bin accordance with\b/gi, "per"],
  [/\bin conjunction with\b/gi, "with"],
  [/\bwith the help of\b/gi, "using"],
  [/\bby means of\b/gi, "by"],
  [/\bwith the exception of\b/gi, "except"],
  [/\bin the absence of\b/gi, "without"],
  // time
  [/\b(?:in|during) the course of\b/gi, "during"],
  [/\buntil such time as\b/gi, "until"],
  [/\bduring the time that\b/gi, "while"],
  [/\bat (?:this point in time|the present time|the present moment)\b/gi, "now"],
  [/\bin the (?:near|not too distant) future\b/gi, "soon"],
  [/\bprior to\b/gi, "before"],
  [/\bin advance of\b/gi, "before"],
  [/\bsubsequent to\b/gi, "after"],
  [/\bfollowing the completion of\b/gi, "after"],
  [/\bon a regular basis\b/gi, "regularly"],
  [/\bon a (daily|weekly|monthly|quarterly|yearly) basis\b/gi, "$1"],
  [/\bin a timely manner\b/gi, "promptly"],
  [/\bat all times\b/gi, "always"],
  // quantity
  [/\ba large number of\b/gi, "many"],
  [/\ba (?:significant|substantial|considerable) number of\b/gi, "many"],
  [/\ba (?:small|limited) number of\b/gi, "a few"],
  [/\ba (?:sufficient|adequate) number of\b/gi, "enough"],
  [/\ba number of\b/gi, "several"],
  [/\b(?:the|a) majority of\b/gi, "most"],
  [/\ba great deal of\b/gi, "much"],
  [/\bin most cases\b/gi, "usually"],
  [/\bin many cases\b/gi, "often"],
  // capability / action
  [/\b(?:has|have) the ability to\b/gi, "can"],
  [/\b(?:has|have) the capacity to\b/gi, "can"],
  [/\b(?:is|are) able to\b/gi, "can"],
  [/\bmakes use of\b/gi, "uses"],
  [/\bmake use of\b/gi, "use"],
  [/\butilizes\b/gi, "uses"],
  [/\butilize\b/gi, "use"],
  [/\butilization\b/gi, "use"],
  [/\btakes into (?:account|consideration)\b/gi, "considers"],
  [/\btake into (?:account|consideration)\b/gi, "consider"],
  // redundant pairs
  [/\beach and every\b/gi, "every"],
  [/\bany and all\b/gi, "all"],
  [/\bfirst and foremost\b/gi, "first"],
  [/\bend result\b/gi, "result"],
  [/\bfinal outcome\b/gi, "outcome"],
  [/\bfuture plans\b/gi, "plans"],
  [/\bpast history\b/gi, "history"],
  [/\bcompletely eliminate\b/gi, "eliminate"],
  [/\babsolutely essential\b/gi, "essential"],
  [/\bbasic fundamentals\b/gi, "fundamentals"],
  // de-nominalizations (verb buried in a noun phrase -> the verb)
  [/\bcome to the conclusion that\b/gi, "conclude that"],
  [/\bgive consideration to\b/gi, "consider"],
  [/\b(?:provide|give) an explanation (?:of|for)\b/gi, "explain"],
  [/\bmake a decision\b/gi, "decide"],
  [/\bmake an assumption\b/gi, "assume"],
  [/\bmake a recommendation\b/gi, "recommend"],
  [/\b(?:perform|conduct|carry out) an analysis of\b/gi, "analyze"],
  [/\bis dependent (?:on|upon)\b/gi, "depends on"],
  [/\bare dependent (?:on|upon)\b/gi, "depend on"],
  [/\bis indicative of\b/gi, "indicates"],
  [/\bis representative of\b/gi, "represents"],
  [/\bis reflective of\b/gi, "reflects"],
  // purpose / manner
  [/\bin an (?:effort|attempt) to\b/gi, "to"],
  [/\bto be able to\b/gi, "to"],
  [/\bin such a way that\b/gi, "so that"],
  [/\bthe (?:way|manner) in which\b/gi, "how"],
  [/\bthe extent to which\b/gi, "how much"],
  // reference / relation
  [/\bin regards? to\b/gi, "regarding"],
  [/\bas regards\b/gi, "regarding"],
  [/\bpertaining to\b/gi, "about"],
  // quantity / frequency
  [/\bfor the most part\b/gi, "mostly"],
  [/\bmore often than not\b/gi, "usually"],
  [/\bin the vast majority of cases\b/gi, "usually"],
  [/\ba wide range of\b/gi, "many"],
  [/\ba (?:wide )?variety of\b/gi, "various"],
  [/\ba total of\b/gi, ""],
  [/\b(all|both|half) of the\b/gi, "$1 the"],
  // time
  [/\bat (?:this juncture|this moment in time)\b/gi, "now"],
  [/\bin spite of\b/gi, "despite"],
  [/\bin (?:this day and age|today'?s world)\b/gi, "today"],
  // more de-nominalizations
  [/\b(?:provide|give) a description of\b/gi, "describe"],
  [/\bmake (?:a comparison|comparisons) (?:of|between)\b/gi, "compare"],
  [/\bmake (?:modifications|changes) to\b/gi, "change"],
  [/\bmake an attempt to\b/gi, "try to"],
  [/\bmake reference to\b/gi, "reference"],
  [/\bmake mention of\b/gi, "mention"],
  [/\bmake a determination\b/gi, "determine"],
  [/\bmake an evaluation of\b/gi, "evaluate"],
  [/\b(?:perform|conduct) a review of\b/gi, "review"],
  [/\b(?:carry out|conduct|perform) an investigation of\b/gi, "investigate"],
  [/\bgives rise to\b/gi, "causes"],
  [/\bgive rise to\b/gi, "cause"],
  [/\b(?:reach|arrive at) a decision\b/gi, "decide"],
  [/\b(?:put|place) (?:an )?emphasis on\b/gi, "emphasize"],
  [/\btake a look at\b/gi, "review"],
  [/\bhas an impact on\b/gi, "affects"],
  [/\bhave an impact on\b/gi, "affect"],
  [/\bhas a tendency to\b/gi, "tends to"],
  [/\bhave a tendency to\b/gi, "tend to"],
  [/\b(?:has|have) the option to\b/gi, "can"],
  [/\bhave a preference for\b/gi, "prefer"],
  [/\bhave a need (?:for|to)\b/gi, "need"],
  [/\bis in agreement with\b/gi, "agrees with"],
  [/\bis in possession of\b/gi, "has"],
  // causation / basis
  [/\bin order for\b/gi, "for"],
  [/\bas a (?:result|consequence) of\b/gi, "because of"],
  [/\bon the basis of\b/gi, "based on"],
  [/\bfor the simple reason that\b/gi, "because"],
  // quantity / frequency
  [/\bthe majority of the time\b/gi, "usually"],
  [/\bwith the possible exception of\b/gi, "except"],
  [/\bfew and far between\b/gi, "rare"],
  [/\bfirst of all\b/gi, "first"],
  [/\blast but not least\b/gi, "finally"],
  // connectives / generic (run after the specifics above)
  [/\bas well as\b/gi, "and"],
  [/\bin addition to\b/gi, "besides"],
  [/\bthe reason why\b/gi, "why"],
  [/\b(?:the question )?as to whether\b/gi, "whether"],
  [/\bwhether or not\b/gi, "whether"],
  [/\bthe fact that\b/gi, "that"]
];
var FILLER_NOISE = [
  /\bit is important to note that\b/gi,
  /\bit is worth noting that\b/gi,
  /\bit should be noted that\b/gi,
  /\bit goes without saying that\b/gi,
  /\bit is recommended that\b/gi,
  /\bplease (?:note|be advised) that\b/gi,
  /\bneedless to say\b/gi,
  /\bas a matter of fact\b/gi,
  /\bfor what it'?s worth\b/gi,
  /\bat the end of the day\b/gi,
  /\bin (?:my|our) (?:honest )?opinion\b/gi,
  /\bas you (?:can see|know|are aware)\b/gi,
  /\b(?:to be honest|in all honesty|honestly speaking)\b/gi,
  /\bfeel free to\b/gi,
  /\bgo ahead and\b/gi,
  /\bthe bottom line is\b/gi,
  /\bit is worth mentioning that\b/gi,
  /\bas (?:previously |earlier )?(?:mentioned|stated|noted)(?: (?:above|earlier|previously))?\b/gi,
  /\bfor all intents and purposes\b/gi,
  /\b(?:in a nutshell|to put it simply|simply put|in short)\b/gi,
  /\b(?:that being said|having said that|with that said|that said)\b/gi,
  /\bas far as (?:i am|i'?m) concerned\b/gi,
  /\b(?:to tell you the truth|the truth of the matter is)\b/gi,
  /\bbelieve it or not\b/gi,
  /\b(?:in the final analysis|when all is said and done|by and large)\b/gi,
  /\bdo me a favor and\b/gi,
  /\b(?:basically|actually|essentially|simply|obviously|clearly|literally)\b/gi
];
var HEDGES = [
  /\b(?:kind of|sort of|more or less|pretty much|to some extent|in a sense|so to speak|if you will)\b/gi,
  /\b(?:really|very|quite|rather|somewhat|fairly|truly|genuinely)\b/gi
];
var POLITENESS = [
  /\bplease\b/gi,
  /\bkindly\b/gi,
  /\bif (?:it'?s |it is )?possible\b/gi,
  /\bif you (?:don'?t mind|would be so kind)\b/gi,
  /\b(?:when you (?:get|have) (?:a|the) chance|at your earliest convenience)\b/gi,
  /\b(?:thank you|thanks)(?: (?:very much|so much|a lot|in advance))?[.!]?/gi
];
var FIRST_PERSON_PREAMBLES = [
  /\bwhat i(?:'d| would)? (?:want|like)(?: you)? to do is (?:to )?/gi,
  /\bwhat i (?:mean|am saying|'m saying) is:?\s*/gi,
  /\bi (?:was )?wondering if you (?:could|can|would) /gi,
  /\bi was hoping (?:that )?you could /gi,
  /\bi(?:'d| would)? appreciate (?:it )?if you (?:could|would|can) /gi,
  /\bi would be grateful if you (?:could|would) /gi,
  /\bi(?:'d| would)? like for you to /gi,
  /\bi(?:'d| would)? (?:just )?(?:like|want)(?: you)? to /gi,
  /\bi(?:'m| am) (?:looking|hoping) to /gi,
  /\bi(?:'m| am) interested in /gi,
  /\bi need you to /gi,
  /\bi'?m trying to /gi,
  /\b(?:my|the) (?:goal|task|objective|job|aim) is to /gi,
  /\byour (?:job|task|role|goal) is to /gi
];
var SENTENCE_START_PREAMBLES = [
  /(^|[\n.!?]\s*)(?:can|could|would|will) you(?:,? please)? /gi,
  /(^|[\n.!?]\s*)(?:would it be|is it) possible (?:for you )?to /gi
];
var CONTRACTIONS = [
  [/\bcan ?not\b/gi, "can't"],
  [/\bdo not\b/gi, "don't"],
  [/\bdoes not\b/gi, "doesn't"],
  [/\bdid not\b/gi, "didn't"],
  [/\bis not\b/gi, "isn't"],
  [/\bare not\b/gi, "aren't"],
  [/\bwas not\b/gi, "wasn't"],
  [/\bwere not\b/gi, "weren't"],
  [/\bhas not\b/gi, "hasn't"],
  [/\bhave not\b/gi, "haven't"],
  [/\bhad not\b/gi, "hadn't"],
  [/\bwill not\b/gi, "won't"],
  [/\bwould not\b/gi, "wouldn't"],
  [/\bshould not\b/gi, "shouldn't"],
  [/\bcould not\b/gi, "couldn't"],
  [/\bmust not\b/gi, "mustn't"],
  [/\bit is\b/gi, "it's"],
  [/\bthat is\b/gi, "that's"],
  [/\bthere is\b/gi, "there's"],
  [/\bhere is\b/gi, "here's"],
  [/\bwhat is\b/gi, "what's"],
  [/\bwho is\b/gi, "who's"],
  [/\byou are\b/gi, "you're"],
  [/\bwe are\b/gi, "we're"],
  [/\bthey are\b/gi, "they're"],
  [/\bI am\b/g, "I'm"],
  [/\b(you|we|they|I) will\b/gi, "$1'll"],
  [/\b(you|we|they|I) would\b/gi, "$1'd"],
  [/\b(you|we|they|I) have\b(?! to\b)/gi, "$1've"]
];
var SENTINEL = String.fromCharCode(0);
var PLACEHOLDER = new RegExp(SENTINEL + "(\\d+)" + SENTINEL, "g");
function maskCode(input) {
  const segments = [];
  const stash = (m) => {
    const i = segments.length;
    segments.push(m);
    return SENTINEL + i + SENTINEL;
  };
  const masked = input.replace(/```[\s\S]*?```/g, stash).replace(/`[^`\n]+`/g, stash);
  return { masked, segments };
}
function restoreCode(text, segments) {
  return text.replace(PLACEHOLDER, (_, i) => segments[Number(i)] ?? "");
}
function collapseWhitespace(s) {
  return s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function compileCustomRules(rules = []) {
  const compiled = [];
  for (const rule of rules) {
    if (!rule || !rule.find) {
      continue;
    }
    try {
      const source = rule.regex ? rule.find : /^\w[\s\S]*\w$|^\w$/.test(rule.find) ? `\\b${escapeRegExp(rule.find)}\\b` : escapeRegExp(rule.find);
      compiled.push([new RegExp(source, "gi"), rule.replace ?? ""]);
    } catch {
    }
  }
  return compiled;
}
function optimizePrompt(input, options = DEFAULT_OPTIONS) {
  const applied = [];
  const { masked, segments } = maskCode(input);
  let out = masked;
  const custom = compileCustomRules(options.customRules);
  if (custom.length) {
    const before = out;
    for (const [re, rep] of custom) {
      out = out.replace(re, rep);
    }
    if (out !== before) {
      applied.push("custom rules");
    }
  }
  if (options.simplifyVerbosePhrases) {
    const before = out;
    for (const [re, rep] of VERBOSE_PHRASES) {
      out = out.replace(re, rep);
    }
    if (out !== before) {
      applied.push("verbose phrases");
    }
  }
  if (options.removeFillerWords) {
    const before = out;
    for (const re of FILLER_NOISE) {
      out = out.replace(re, "");
    }
    for (const re of HEDGES) {
      out = out.replace(re, "");
    }
    for (const re of POLITENESS) {
      out = out.replace(re, "");
    }
    for (const re of FIRST_PERSON_PREAMBLES) {
      out = out.replace(re, "");
    }
    for (const re of SENTENCE_START_PREAMBLES) {
      out = out.replace(re, "$1");
    }
    if (out !== before) {
      applied.push("filler words");
    }
  }
  if (options.contractions) {
    const before = out;
    for (const [re, rep] of CONTRACTIONS) {
      out = out.replace(re, rep);
    }
    if (out !== before) {
      applied.push("contractions");
    }
  }
  if (options.removeFillerWords || options.simplifyVerbosePhrases || custom.length) {
    out = out.replace(/[ \t]{2,}/g, " ").replace(/([,;:])(?:\s*[,;:])+/g, "$1").replace(/ +([.,;:!?])/g, "$1").replace(/([,;:]) *([.!?])/g, "$2").replace(/^[ \t,;:]+/, "").replace(/\n[ \t,;:]+/g, "\n");
  }
  if (options.collapseWhitespace) {
    const before = out;
    out = collapseWhitespace(out);
    if (out !== before) {
      applied.push("whitespace");
    }
  } else {
    out = out.trim();
  }
  return { optimized: restoreCode(out, segments), applied };
}
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
var DEFAULT_OUTPUT_OPTIONS = {
  dedupe: true,
  dropNoise: true,
  maxLines: 200,
  headLines: 80,
  tailLines: 80
};
var ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
var NOISE_LINE = [
  /^\s*[⠀-⣿▀-▟|/\\\-]+\s*$/,
  // spinner/braille/box-drawing only
  /^\s*\d{1,3}%(\s|$)/,
  // leading percentage progress
  /^\s*[#=>.\-]{3,}\s*\d*%?\s*$/,
  // ascii progress bars
  /\r$/
  // carriage-return progress fragments
];
function compressOutput(input, options = DEFAULT_OUTPUT_OPTIONS) {
  let text = input;
  if (options.dropNoise) {
    text = text.replace(ANSI, "").replace(/\r(?!\n)/g, "\n");
  }
  let lines = text.split("\n");
  const linesBefore = lines.length;
  if (options.dropNoise) {
    lines = lines.filter((l) => !NOISE_LINE.some((re) => re.test(l)));
  }
  if (options.dedupe) {
    const collapsed = [];
    let i = 0;
    while (i < lines.length) {
      let n = 1;
      while (i + n < lines.length && lines[i + n] === lines[i]) {
        n++;
      }
      if (n > 1 && lines[i].trim()) {
        collapsed.push(`${lines[i]}  \u2026 (\xD7${n})`);
      } else {
        collapsed.push(lines[i]);
      }
      i += n;
    }
    lines = collapsed;
  }
  if (options.maxLines > 0 && lines.length > options.maxLines) {
    const head = lines.slice(0, options.headLines);
    const tail = lines.slice(lines.length - options.tailLines);
    const hidden = lines.length - head.length - tail.length;
    lines = [
      ...head,
      `\u2026 (${hidden} line${hidden === 1 ? "" : "s"} hidden by optimize-pilot) \u2026`,
      ...tail
    ];
  }
  return {
    compressed: lines.join("\n"),
    linesBefore,
    linesAfter: lines.length
  };
}
function discover(input, options = DEFAULT_OPTIONS) {
  const base = estimateTokens(input);
  const only = (name, patch) => {
    const opts = {
      collapseWhitespace: false,
      removeFillerWords: false,
      simplifyVerbosePhrases: false,
      contractions: false,
      ...patch
    };
    const { optimized: optimized2 } = optimizePrompt(input, opts);
    return { name, saved: base - estimateTokens(optimized2) };
  };
  const groups = [];
  if (options.simplifyVerbosePhrases) {
    groups.push(only("verbose phrases", { simplifyVerbosePhrases: true }));
  }
  if (options.removeFillerWords) {
    groups.push(only("filler words", { removeFillerWords: true }));
  }
  if (options.contractions) {
    groups.push(only("contractions", { contractions: true }));
  }
  if (options.collapseWhitespace) {
    groups.push(only("whitespace", { collapseWhitespace: true }));
  }
  if (options.customRules && options.customRules.length) {
    groups.push(
      only("custom rules", { customRules: options.customRules })
    );
  }
  const { optimized, applied } = optimizePrompt(input, options);
  const after = estimateTokens(optimized);
  const saved = base - after;
  return {
    optimized,
    estTokensBefore: base,
    estTokensAfter: after,
    saved,
    percent: base > 0 ? Math.round(saved / base * 100) : 0,
    applied,
    groups: groups.sort((a, b) => b.saved - a.saved)
  };
}
function detectProfile(command, output = "") {
  const c = (command || "").toLowerCase();
  if (/\b(jest|vitest)\b/.test(c) || /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b/.test(c) || /\b(npm|pnpm|yarn)\s+t\b/.test(c)) {
    return "jest";
  }
  if (/\b(npm|pnpm|bun)\s+(i|ci|install|add)\b/.test(c) || /\byarn\s+(install|add)\b/.test(c)) {
    return "npm-install";
  }
  if (/\bgit\s+status\b/.test(c)) {
    return "git-status";
  }
  if (/\bgit\s+log\b/.test(c)) {
    return "git-log";
  }
  if (/\bgit\s+(diff|show)\b/.test(c)) {
    return "git-diff";
  }
  if (!command && /^\s*(Tests:|Test Suites:)/m.test(output)) {
    return "jest";
  }
  return "generic";
}
function keepTestFailures(output) {
  return output.replace(ANSI, "").split("\n").filter((line) => {
    const t = line.trim();
    if (/^PASS\b/.test(t)) {
      return false;
    }
    if (/^[✓✔√]\s/.test(t)) {
      return false;
    }
    return true;
  }).join("\n");
}
function stripNpmNoise(output) {
  const kept = [];
  let deprecated = 0;
  for (const line of output.replace(ANSI, "").split("\n")) {
    const t = line.trim();
    if (/^npm (timing|http|sill|silly|verbose|info)\b/i.test(t)) {
      continue;
    }
    if (/^npm warn deprecated\b/i.test(t)) {
      deprecated++;
      continue;
    }
    kept.push(line);
  }
  if (deprecated) {
    kept.push(
      `npm warn: ${deprecated} deprecated-package warning(s) suppressed by optimize-pilot`
    );
  }
  return kept.join("\n");
}
function stripGitStatusHints(output) {
  return output.replace(ANSI, "").split("\n").filter((line) => !/^\s*\(use\b/.test(line)).join("\n");
}
function optimizeCommandOutput(command, output, options = DEFAULT_OUTPUT_OPTIONS) {
  const linesBefore = output.split("\n").length;
  const profile = detectProfile(command, output);
  let pre = output;
  switch (profile) {
    case "jest":
      pre = keepTestFailures(output);
      break;
    case "npm-install":
      pre = stripNpmNoise(output);
      break;
    case "git-status":
      pre = stripGitStatusHints(output);
      break;
  }
  const { compressed, linesAfter } = compressOutput(pre, options);
  return { compressed, profile, linesBefore, linesAfter };
}
var DEFAULT_DOCUMENT_OPTIONS = {
  dedupeBlocks: true,
  minDuplicateChars: 40,
  applyProseRules: true
};
function normalizeBlockKey(block) {
  return block.toLowerCase().replace(/[*_`#>~]/g, "").replace(/^\s*[-+]\s+/gm, "").replace(/\s+/g, " ").trim();
}
function compressDocument(input, options = DEFAULT_DOCUMENT_OPTIONS) {
  const applied = [];
  const { masked, segments } = maskCode(input);
  const prepared = masked.replace(/\n(#{1,6} )/g, "\n\n$1").replace(/(^|\n)(#{1,6} [^\n]*)\n(?=\S)/g, "$1$2\n\n");
  const blocks = prepared.split(/\n{2,}/);
  const blocksBefore = blocks.length;
  let kept = blocks;
  let duplicatesRemoved = 0;
  if (options.dedupeBlocks) {
    const seen = /* @__PURE__ */ new Set();
    kept = [];
    for (const block of blocks) {
      const key = normalizeBlockKey(block);
      const dedupable = key.length >= options.minDuplicateChars;
      if (dedupable && seen.has(key)) {
        duplicatesRemoved++;
        continue;
      }
      if (dedupable) {
        seen.add(key);
      }
      kept.push(block);
    }
    if (duplicatesRemoved > 0) {
      applied.push(`deduped ${duplicatesRemoved} block(s)`);
    }
  }
  let out = restoreCode(kept.join("\n\n"), segments);
  if (options.applyProseRules) {
    const r = optimizePrompt(out);
    out = r.optimized;
    applied.push(...r.applied);
  } else {
    out = out.trim();
  }
  return {
    compressed: out,
    blocksBefore,
    blocksAfter: kept.length,
    duplicatesRemoved,
    applied
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_DOCUMENT_OPTIONS,
  DEFAULT_OPTIONS,
  DEFAULT_OUTPUT_OPTIONS,
  compileCustomRules,
  compressDocument,
  compressOutput,
  detectProfile,
  discover,
  estimateTokens,
  optimizeCommandOutput,
  optimizePrompt
});
