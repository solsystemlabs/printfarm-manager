const path = require('node:path');
const { BaseIdeSetup } = require('./_base-ide');
const chalk = require('chalk');

/**
 * Trae IDE setup handler
 */
class TraeSetup extends BaseIdeSetup {
  constructor() {
    super('trae', 'Trae');
    this.configDir = '.trae';
    this.rulesDir = 'rules';
  }

  /**
   * Setup Trae IDE configuration
   * @param {string} projectDir - Project directory
   * @param {string} bmadDir - BMAD installation directory
   * @param {Object} options - Setup options
   */
  async setup(projectDir, bmadDir, options = {}) {
    console.log(chalk.cyan(`Setting up ${this.name}...`));

    // Create .trae/rules directory
    const traeDir = path.join(projectDir, this.configDir);
    const rulesDir = path.join(traeDir, this.rulesDir);

    await this.ensureDir(rulesDir);

    // Get agents and tasks
    const agents = await this.getAgents(bmadDir);
    const tasks = await this.getTasks(bmadDir);

    // Process agents as rules
    let ruleCount = 0;
    for (const agent of agents) {
      const content = await this.readFile(agent.path);
      const processedContent = this.createAgentRule(agent, content, bmadDir, projectDir);

      const targetPath = path.join(rulesDir, `${agent.module}-${agent.name}.md`);
      await this.writeFile(targetPath, processedContent);
      ruleCount++;
    }

    // Process tasks as rules
    for (const task of tasks) {
      const content = await this.readFile(task.path);
      const processedContent = this.createTaskRule(task, content);

      const targetPath = path.join(rulesDir, `task-${task.module}-${task.name}.md`);
      await this.writeFile(targetPath, processedContent);
      ruleCount++;
    }

    console.log(chalk.green(`✓ ${this.name} configured:`));
    console.log(chalk.dim(`  - ${ruleCount} rules created`));
    console.log(chalk.dim(`  - Rules directory: ${path.relative(projectDir, rulesDir)}`));
    console.log(chalk.dim(`  - Agents can be activated with @{agent-name}`));

    return {
      success: true,
      rules: ruleCount,
    };
  }

  /**
   * Create rule content for an agent
   */
  createAgentRule(agent, content, bmadDir, projectDir) {
    // Extract metadata from agent content
    const titleMatch = content.match(/title="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : this.formatTitle(agent.name);

    const iconMatch = content.match(/icon="([^"]+)"/);
    const icon = iconMatch ? iconMatch[1] : '🤖';

    // Extract YAML content if available
    const yamlMatch = content.match(/```ya?ml\r?\n([\s\S]*?)```/);
    const yamlContent = yamlMatch ? yamlMatch[1] : content;

    // Calculate relative path for reference
    const relativePath = path.relative(projectDir, agent.path).replaceAll('\\', '/');

    let ruleContent = `# ${title} Agent Rule

This rule is triggered when the user types \`@${agent.name}\` and activates the ${title} agent persona.

## Agent Activation

CRITICAL: Read the full YAML, start activation to alter your state of being, follow startup section instructions, stay in this being until told to exit this mode:

\`\`\`yaml
${yamlContent}
\`\`\`

## File Reference

The complete agent definition is available in [${relativePath}](${relativePath}).

## Usage

When the user types \`@${agent.name}\`, activate this ${title} persona and follow all instructions defined in the YAML configuration above.

## Module

Part of the BMAD ${agent.module.toUpperCase()} module.
`;

    return ruleContent;
  }

  /**
   * Create rule content for a task
   */
  createTaskRule(task, content) {
    // Extract task name from content
    const nameMatch = content.match(/<name>([^<]+)<\/name>/);
    const taskName = nameMatch ? nameMatch[1] : this.formatTitle(task.name);

    let ruleContent = `# ${taskName} Task Rule

This rule defines the ${taskName} task workflow.

## Task Definition

When this task is triggered, execute the following workflow:

${content}

## Usage

Reference this task with \`@task-${task.name}\` to execute the defined workflow.

## Module

Part of the BMAD ${task.module.toUpperCase()} module.
`;

    return ruleContent;
  }

  /**
   * Format agent/task name as title
   */
  formatTitle(name) {
    return name
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Cleanup Trae configuration
   */
  async cleanup(projectDir) {
    const fs = require('fs-extra');
    const rulesPath = path.join(projectDir, this.configDir, this.rulesDir);

    if (await fs.pathExists(rulesPath)) {
      // Only remove BMAD rules
      const files = await fs.readdir(rulesPath);
      let removed = 0;

      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(rulesPath, file);
          const content = await fs.readFile(filePath, 'utf8');

          // Check if it's a BMAD rule
          if (content.includes('BMAD') && content.includes('module')) {
            await fs.remove(filePath);
            removed++;
          }
        }
      }

      console.log(chalk.dim(`Removed ${removed} BMAD rules from Trae`));
    }
  }
}

module.exports = { TraeSetup };
