#!/usr/bin/env python3
"""
Make Lint Module for Oracle MVP Codebase

This script provides comprehensive linting and formatting checks for the entire codebase.
It runs ESLint, Prettier, TypeScript checks, and other quality assurance tools.

Usage:
    python make_lint.py [options]

Options:
    --fix          Automatically fix linting issues where possible
    --check-only   Only check for issues without fixing
    --verbose      Show detailed output
    --help         Show this help message
"""

import os
import sys
import subprocess
import argparse
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import time


class LintChecker:
    """Main linting orchestrator for the Oracle MVP codebase."""
    
    def __init__(self, fix: bool = False, verbose: bool = False):
        self.fix = fix
        self.verbose = verbose
        self.root_dir = Path(__file__).parent
        self.results: Dict[str, Any] = {
            "start_time": time.time(),
            "checks": {},
            "errors": [],
            "warnings": [],
            "summary": {}
        }
        
    def log(self, message: str, level: str = "INFO"):
        """Log messages with timestamp and level."""
        timestamp = time.strftime("%H:%M:%S")
        prefix = f"[{timestamp}] {level}"
        if self.verbose or level in ["ERROR", "WARN"]:
            print(f"{prefix}: {message}")
    
    def run_command(self, command: List[str], cwd: Optional[Path] = None, 
                   description: str = "") -> Dict[str, Any]:
        """Run a shell command and return results."""
        if cwd is None:
            cwd = self.root_dir
            
        self.log(f"Running: {' '.join(command)}", "INFO")
        
        try:
            result = subprocess.run(
                command,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            return {
                "success": result.returncode == 0,
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "description": description
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "returncode": -1,
                "stdout": "",
                "stderr": f"Command timed out after 5 minutes: {description}",
                "description": description
            }
        except Exception as e:
            return {
                "success": False,
                "returncode": -1,
                "stdout": "",
                "stderr": str(e),
                "description": description
            }
    
    def check_node_modules(self) -> bool:
        """Check if node_modules exists and is properly installed."""
        node_modules = self.root_dir / "node_modules"
        package_json = self.root_dir / "package.json"
        
        if not package_json.exists():
            self.log("package.json not found", "ERROR")
            return False
            
        if not node_modules.exists():
            self.log("node_modules not found. Run 'npm install' first.", "ERROR")
            return False
            
        return True
    
    def run_eslint(self) -> Dict[str, Any]:
        """Run ESLint on the codebase."""
        if self.fix:
            command = ["npx", "eslint", ".", "--ext", ".ts,.tsx,.js,.jsx", "--fix"]
            description = "ESLint with auto-fix"
        else:
            command = ["npx", "eslint", ".", "--ext", ".ts,.tsx,.js,.jsx"]
            description = "ESLint check"
            
        return self.run_command(command, description=description)
    
    def run_prettier(self) -> Dict[str, Any]:
        """Run Prettier on the codebase."""
        if self.fix:
            command = ["npx", "prettier", "--write", "."]
            description = "Prettier format"
        else:
            command = ["npx", "prettier", "--check", "."]
            description = "Prettier check"
            
        return self.run_command(command, description=description)
    
    def run_typescript_check(self) -> Dict[str, Any]:
        """Run TypeScript type checking."""
        command = ["npx", "tsc", "--noEmit"]
        return self.run_command(command, description="TypeScript type check")
    
    def run_drizzle_check(self) -> Dict[str, Any]:
        """Check Drizzle database schema."""
        command = ["npx", "drizzle-kit", "check"]
        return self.run_command(command, description="Drizzle schema check")
    
    def run_test_scripts(self) -> Dict[str, Any]:
        """Run test scripts to ensure code quality."""
        test_results = {}
        
        # Test scripts from package.json
        test_commands = [
            (["npm", "run", "test:auth"], "Authentication tests"),
            (["npm", "run", "test:crypto"], "Crypto utility tests"),
            (["npm", "run", "test:csv"], "CSV processing tests"),
            (["npm", "run", "test:substitution"], "Variable substitution tests"),
        ]
        
        for command, description in test_commands:
            result = self.run_command(command, description=description)
            test_results[description] = result
            
        return test_results
    
    def check_file_structure(self) -> Dict[str, Any]:
        """Check if all required files and directories exist."""
        required_paths = [
            "client/src",
            "server",
            "worker",
            "shared",
            "package.json",
            "tsconfig.json",
            "drizzle.config.ts",
            "vite.config.ts",
            "tailwind.config.ts"
        ]
        
        missing_paths = []
        for path in required_paths:
            if not (self.root_dir / path).exists():
                missing_paths.append(path)
        
        return {
            "success": len(missing_paths) == 0,
            "missing_paths": missing_paths,
            "description": "File structure check"
        }
    
    def check_environment_variables(self) -> Dict[str, Any]:
        """Check if required environment variables are documented."""
        env_example = self.root_dir / ".env.example"
        env_validation = self.root_dir / "shared/env-validation.ts"
        
        checks = {
            "env_example_exists": env_example.exists(),
            "env_validation_exists": env_validation.exists(),
        }
        
        return {
            "success": all(checks.values()),
            "checks": checks,
            "description": "Environment configuration check"
        }
    
    def run_all_checks(self) -> bool:
        """Run all linting and quality checks."""
        self.log("Starting comprehensive code quality check...", "INFO")
        
        # Prerequisites
        if not self.check_node_modules():
            return False
        
        # Core linting
        self.results["checks"]["eslint"] = self.run_eslint()
        self.results["checks"]["prettier"] = self.run_prettier()
        self.results["checks"]["typescript"] = self.run_typescript_check()
        
        # Database and schema
        self.results["checks"]["drizzle"] = self.run_drizzle_check()
        
        # File structure and configuration
        self.results["checks"]["file_structure"] = self.check_file_structure()
        self.results["checks"]["environment"] = self.check_environment_variables()
        
        # Tests
        self.results["checks"]["tests"] = self.run_test_scripts()
        
        # Analyze results
        self.analyze_results()
        
        return self.results["summary"]["overall_success"]
    
    def analyze_results(self):
        """Analyze and summarize all check results."""
        total_checks = 0
        successful_checks = 0
        errors = []
        warnings = []
        
        for check_name, result in self.results["checks"].items():
            total_checks += 1
            
            if isinstance(result, dict):
                if result.get("success", False):
                    successful_checks += 1
                else:
                    errors.append(f"{check_name}: {result.get('description', 'Check failed')}")
                    
                    # Add stderr output if available
                    if result.get("stderr"):
                        errors.append(f"  Details: {result['stderr'][:200]}...")
            elif isinstance(result, dict) and "tests" in check_name:
                # Handle test results specially
                for test_name, test_result in result.items():
                    total_checks += 1
                    if test_result.get("success", False):
                        successful_checks += 1
                    else:
                        errors.append(f"{test_name}: {test_result.get('description', 'Test failed')}")
        
        self.results["summary"] = {
            "total_checks": total_checks,
            "successful_checks": successful_checks,
            "failed_checks": total_checks - successful_checks,
            "overall_success": successful_checks == total_checks,
            "success_rate": (successful_checks / total_checks * 100) if total_checks > 0 else 0
        }
        
        self.results["errors"] = errors
        self.results["warnings"] = warnings
    
    def print_summary(self):
        """Print a formatted summary of all checks."""
        summary = self.results["summary"]
        
        print("\n" + "="*60)
        print("ORACLE MVP - CODE QUALITY CHECK SUMMARY")
        print("="*60)
        
        print(f"Total Checks: {summary['total_checks']}")
        print(f"Successful: {summary['successful_checks']}")
        print(f"Failed: {summary['failed_checks']}")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        
        if summary["overall_success"]:
            print("\n✅ All checks passed! Code quality is excellent.")
        else:
            print(f"\n❌ {summary['failed_checks']} check(s) failed.")
            
            if self.results["errors"]:
                print("\nErrors:")
                for error in self.results["errors"]:
                    print(f"  • {error}")
        
        duration = time.time() - self.results["start_time"]
        print(f"\nDuration: {duration:.2f} seconds")
        print("="*60)
    
    def save_results(self, output_file: str = "lint_results.json"):
        """Save detailed results to a JSON file."""
        output_path = self.root_dir / output_file
        
        # Remove start_time from results for JSON serialization
        results_copy = self.results.copy()
        results_copy["start_time"] = str(results_copy["start_time"])
        
        with open(output_path, 'w') as f:
            json.dump(results_copy, f, indent=2)
        
        self.log(f"Detailed results saved to: {output_file}", "INFO")


def main():
    """Main entry point for the make_lint script."""
    parser = argparse.ArgumentParser(
        description="Comprehensive code quality checker for Oracle MVP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python make_lint.py              # Check only
    python make_lint.py --fix        # Check and fix issues
    python make_lint.py --verbose    # Verbose output
    python make_lint.py --check-only --verbose  # Verbose check only
        """
    )
    
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Automatically fix linting issues where possible"
    )
    
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Only check for issues without fixing (overrides --fix)"
    )
    
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed output"
    )
    
    parser.add_argument(
        "--save-results",
        action="store_true",
        help="Save detailed results to lint_results.json"
    )
    
    args = parser.parse_args()
    
    # Determine if we should fix or just check
    fix_mode = args.fix and not args.check_only
    
    # Create and run the lint checker
    checker = LintChecker(fix=fix_mode, verbose=args.verbose)
    
    try:
        success = checker.run_all_checks()
        checker.print_summary()
        
        if args.save_results:
            checker.save_results()
        
        # Exit with appropriate code
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\n\n❌ Linting interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
