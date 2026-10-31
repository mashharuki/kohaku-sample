#!/usr/bin/env python3
"""Static scan for common Kohaku SDK integration pitfalls.

Usage: python3 kohaku_audit.py <path> [--json]

Hits are leads, not verdicts: confirm each by reading the code. Exit code 1 if any
critical/high finding is reported. Only reads files; makes no network calls.
"""
import json
import os
import re
import sys

EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"}
SKIP_DIRS = {"node_modules", "dist", "build", ".git", ".next", "coverage", "out", ".turbo"}
TEST_HINT = re.compile(r"(\.test\.|\.spec\.|/tests?/|__tests__|/e2e/|/fixtures?/|mock)", re.I)

# (id, severity, regex, message, skip_in_tests)
LINE_RULES = [
    ("native-asset", "high", re.compile(r"__type\s*:\s*['\"]native['\"]"),
     "ETH must be { __type: 'erc20', contract: E_ADDRESS }; 'native' is rejected by prepareUnshield.", False),
    ("memory-storage", "high", re.compile(r"new\s+MemoryStorage\s*\("),
     "MemoryStorage outside tests: state lost on restart, unencrypted. Use encrypted persistent storage.", True),
    ("sign-entropy", "critical", re.compile(r"setSignEntropy\s*\(\s*true"),
     "Non-deterministic signatures break note re-derivation (funds unspendable after restart).", False),
    ("verify-determinism-off", "critical", re.compile(r"verifyDeterminism\s*:\s*false"),
     "Determinism check disabled; only acceptable for a proven RFC6979 signer.", False),
    ("random-delegation", "high", re.compile(r"mode\s*:\s*['\"]random['\"]"),
     "delegation random = unrecoverable sender if the userOp stalls; prefer deterministic.", False),
    ("dev-options-on", "low", re.compile(r"enable(Immutable|Serializable)Check\s*:\s*true"),
     "Redux dev checks are slow on full pool state; keep off in production.", True),
    ("legacy-secret-manager", "high", re.compile(r"secretManager\s*:\s*SecretManager\b|secretManagerFactory"),
     "Secret manager override: must match the scheme that created existing notes (switching hides notes).", False),
    ("relayer-mode", "medium", re.compile(r"mode\s*:\s*['\"]relayer['\"]"),
     "Legacy relayer mode; docs recommend mode: 'paymaster'.", False),
    ("helios-no-bypass", "medium", re.compile(r"helios\s*\([^)]*,\s*['\"][a-z]+['\"]\s*,\s*false"),
     "Helios with bypassLogs=false serves logs only for ~8191 blocks; PP/TC cold sync will fail.", False),
    ("passthrough-worker", "high", re.compile(r"0x4fd77be300f31c5fe6ab266d35d27750a3478d27", re.I),
     "anon-rpc passthrough worker anonymizes nothing; don't present it as private.", False),
    ("log-secret", "critical", re.compile(r"console\.(log|info|debug)\([^)]*(mnemonic|privateKey|tornado-[a-z]+-[0-9.]+-[0-9]+-0x|deriveAt)", re.I),
     "Possible secret/note logging.", False),
    ("plain-network-fetch", "medium", re.compile(r"network\s*:\s*\{\s*fetch\s*:\s*(globalThis\.)?fetch\b"),
     "host.network.fetch is raw global fetch: relayer/bundler/ASP see the user's IP and no allowlist applies.", True),
    ("bigint-json", "medium", re.compile(r"JSON\.stringify\(\s*(op|operation|receipt|notes|history)\b"),
     "Kohaku objects contain bigint; JSON.stringify throws without a replacer.", False),
]


def iter_files(root):
    if os.path.isfile(root):
        yield root
        return
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            if os.path.splitext(f)[1] in EXTS:
                yield os.path.join(d, f)


def scan_file(path, text, findings):
    is_test = bool(TEST_HINT.search(path.replace("\\", "/")))
    lines = text.splitlines()
    for i, line in enumerate(lines, 1):
        for rid, sev, rx, msg, skip_tests in LINE_RULES:
            if skip_tests and is_test:
                continue
            if rx.search(line):
                findings.append({"id": rid, "severity": sev, "file": path, "line": i, "message": msg, "code": line.strip()[:160]})

    # prepareUnshield / estimateUnshield without explicit paymaster mode within the call window
    for m in re.finditer(r"\.(prepareUnshield|estimateUnshield)\s*\(", text):
        window = text[m.end(): m.end() + 600]
        depth, end = 1, 0
        for j, ch in enumerate(window):
            depth += ch == "("
            depth -= ch == ")"
            if depth == 0:
                end = j
                break
        call = window[:end] if end else window
        if "paymaster" in call or "mode" in call:
            continue
        ln = text.count("\n", 0, m.start()) + 1
        args_ = [a.strip() for a in call.split(",")]
        third = args_[2] if len(args_) >= 3 else ""
        before = text[max(0, m.start() - 1500): m.start()]
        if re.fullmatch(r"[A-Za-z_$][\w$]*", third) and re.search(r"mode\s*:\s*['\"]paymaster['\"]", before):
            continue  # options object built just above with paymaster mode
        sev = "high" if len(args_) < 3 else "medium"
        findings.append({"id": "missing-paymaster-mode", "severity": sev, "file": path, "line": ln,
                         "message": f"{m.group(1)} without explicit mode: 'paymaster' (omitting it silently uses relayer mode). Verify the options object.",
                         "code": lines[ln - 1].strip()[:160]})

    # exact output without refundRecipient
    for m in re.finditer(r"\bexact\s*:\s*\{", text):
        ctx = text[max(0, m.start() - 600): m.end() + 400]
        if "paymaster" in ctx and "refundRecipient" not in ctx:
            ln = text.count("\n", 0, m.start()) + 1
            findings.append({"id": "exact-without-refund", "severity": "high", "file": path, "line": ln,
                             "message": "Paymaster exact-output requires refundRecipient (throws otherwise).", "code": lines[ln - 1].strip()[:160]})

    # PP paymaster on Sepolia with bundled config
    if re.search(r"PrivacyPoolsV1_0xBow\s*\[\s*11155111", text) and "paymaster" in text and "paymasterConfig" not in text:
        findings.append({"id": "pp-sepolia-paymaster", "severity": "high", "file": path, "line": 1,
                         "message": "Privacy Pools paymaster on Sepolia: bundled Sepolia paymaster is a placeholder (no adapters). Use a mainnet fork or your own paymasterConfig.",
                         "code": ""})

    # Tornado shield without checking deposited sum
    tc_at = text.find("createTCPlugin(")
    tc_shield = text.find("prepareShield", tc_at) if tc_at >= 0 else -1
    if tc_shield >= 0 and not re.search(r"reduce\(.{0,120}?\.value", text, re.S):
        ln = text.count("\n", 0, tc_shield) + 1
        findings.append({"id": "tc-remainder-unchecked", "severity": "medium", "file": path, "line": ln,
                         "message": "Tornado prepareShield drops remainders that fill no pool; sum tx.value and confirm before signing.",
                         "code": lines[ln - 1].strip()[:160]})

    # PP shield without estimateShield/minimumDeposit
    if "createPPv1Plugin" in text and "prepareShield" in text and "minimumDeposit" not in text and not is_test:
        ln = text.count("\n", 0, text.index("prepareShield")) + 1
        findings.append({"id": "pp-min-deposit-unchecked", "severity": "medium", "file": path, "line": ln,
                         "message": "No estimateShield/minimumDeposit check before PP shield (below-minimum deposits revert).",
                         "code": lines[ln - 1].strip()[:160]})


def scan_package_json(path, findings):
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception:
        return
    for section in ("dependencies", "devDependencies", "peerDependencies"):
        for name, ver in (data.get(section) or {}).items():
            if name.startswith("@kohaku-eth/") and not re.fullmatch(r"\d+\.\d+\.\d+(-[\w.]+)?", str(ver)) and not str(ver).startswith("workspace:"):
                findings.append({"id": "unpinned-kohaku", "severity": "medium", "file": path, "line": 1,
                                 "message": f"{name}@{ver} not pinned exactly; alpha APIs and state formats change between releases.",
                                 "code": f'"{name}": "{ver}"'})


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    as_json = "--json" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(2)
    root = args[0]
    findings = []
    for f in iter_files(root):
        try:
            text = open(f, encoding="utf-8", errors="replace").read()
        except Exception:
            continue
        if "kohaku" not in text.lower() and "prepareShield" not in text and "prepareUnshield" not in text:
            continue
        scan_file(f, text, findings)
    for d, dirs, files in os.walk(root) if os.path.isdir(root) else []:
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        if "package.json" in files:
            scan_package_json(os.path.join(d, "package.json"), findings)

    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    findings.sort(key=lambda x: (order[x["severity"]], x["file"], x["line"]))
    if as_json:
        print(json.dumps(findings, indent=2))
    else:
        if not findings:
            print("kohaku_audit: no known pitfalls matched (this does not prove the code is safe).")
        for x in findings:
            print(f"[{x['severity'].upper()}] {x['id']}  {x['file']}:{x['line']}\n    {x['message']}\n    > {x['code']}")
        print(f"\n{len(findings)} finding(s).")
    sys.exit(1 if any(x["severity"] in ("critical", "high") for x in findings) else 0)


if __name__ == "__main__":
    main()
