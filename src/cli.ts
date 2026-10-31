#!/usr/bin/env node
import { Command } from 'commander'
import { runStatus } from './commands/status.js'
import { runTcShield } from './commands/tcShield.js'
import { runTcNotes } from './commands/tcNotes.js'
import { runTcUnshield } from './commands/tcUnshield.js'
import { runPpShield } from './commands/ppShield.js'
import { runPpBalance } from './commands/ppBalance.js'
import { runPpRagequit } from './commands/ppRagequit.js'

const program = new Command()
program.name('kohaku-sample').description('Kohaku SDK (Tornado Cash / Privacy Pools) Sepolia sample CLI').version('0.1.0')

program.command('status').description('Check RPC chain id, wallet address/balance, and storage').action(runStatus)

program
  .command('tc:shield')
  .description('Deposit ETH into Tornado Cash (dry run by default)')
  .option('--amount <eth>', 'amount in ETH', '0.1')
  .option('--strategy <minfee|maxanon>', 'deposit strategy', 'minfee')
  .option('--execute', 'actually send the transaction(s)', false)
  .action(runTcShield)

program.command('tc:notes').description('List Tornado Cash notes and balance').option('--include-spent', 'include spent notes', false).action(runTcNotes)

program
  .command('tc:unshield')
  .description('Withdraw from Tornado Cash via the paymaster (dry run by default)')
  .requiredOption('--to <address>', 'recipient address')
  .option('--amount <eth>', 'amount in ETH', '0.1')
  .option('--strict', 'require a real gas estimate (gasEstimationPolicy: required)', false)
  .option('--call-gas-ceiling <gas>', 'cap the paymaster-sponsored callGasLimit (an untrusted bundler can otherwise raise the fee up to what the note affords)')
  .option('--execute', 'actually send the withdrawal', false)
  .action(runTcUnshield)

program
  .command('pp:shield')
  .description('Deposit ETH into Privacy Pools (dry run by default)')
  .option('--amount <eth>', 'amount in ETH', '0.01')
  .option('--execute', 'actually send the transaction', false)
  .action(runPpShield)

program.command('pp:balance').description('Show Privacy Pools approved/pending balance, notes and history').action(runPpBalance)

program
  .command('pp:ragequit')
  .description('Publicly withdraw pending (not-yet-approved) Privacy Pools notes back to the depositor (dry run by default)')
  .option('--execute', 'actually send the ragequit transaction(s)', false)
  .action(runPpRagequit)

await program.parseAsync(process.argv)
