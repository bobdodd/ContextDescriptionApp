#!/usr/bin/env python3
"""
Deploy ContextDescriptionApp to SiteGround
Uploads the main app to public_html/app/ directory
"""

import ftplib
import os
from pathlib import Path
import argparse
import sys

# Load environment variables if available
try:
    from dotenv import load_dotenv
    # Look for .env file in main app directory
    env_file = Path(__file__).parent / '.env'
    if env_file.exists():
        load_dotenv(env_file)
        print(f"✅ Loaded credentials from {env_file}")
    else:
        print(f"⚠️  No .env file found at {env_file}")
        print("    Create .env file with SiteGround credentials or use environment variables")
except ImportError:
    print("⚠️  python-dotenv not installed, using environment variables only")

class AppDeployer:
    """Deploy ContextDescriptionApp to SiteGround."""
    
    def __init__(self):
        self.host = os.environ.get('SITEGROUND_HOST', '')
        self.username = os.environ.get('SITEGROUND_USERNAME', '')
        self.password = os.environ.get('SITEGROUND_PASSWORD', '')
        self.remote_app_path = 'bobd77.sg-host.com/public_html/app'
        
        # Local app directory
        self.local_app_dir = Path(__file__).parent
        
        # Files and directories to upload
        self.upload_items = [
            'index.html',
            'favicon.ico',
            'src/',
            'styles/',
        ]
        
        # Files to exclude (patterns)
        self.exclude_patterns = [
            '.git',
            '__pycache__',
            '*.pyc',
            '.DS_Store',
            'node_modules',
            'tile-server',
            'original',
            'server.py',
            'deploy_app.py',
            '*.md',
            '*.png',
            'VERSION_COMPARISON.md',
            'SYSTEM_DESIGN.md',
            'TILE_*',
        ]
    
    def should_exclude(self, path):
        """Check if a file/directory should be excluded."""
        path_str = str(path)
        for pattern in self.exclude_patterns:
            if pattern in path_str or path.name == pattern:
                return True
            if pattern.startswith('*.') and path.name.endswith(pattern[1:]):
                return True
        return False
    
    def check_credentials(self):
        """Check if SiteGround credentials are configured."""
        if not all([self.host, self.username, self.password]):
            print("❌ SiteGround credentials not configured")
            print("Set SITEGROUND_HOST, SITEGROUND_USERNAME, SITEGROUND_PASSWORD")
            print("Or create .env file in main app directory with credentials")
            return False
        return True
    
    def create_remote_directory(self, ftp, path):
        """Create remote directory structure if it doesn't exist."""
        parts = path.strip('/').split('/')
        current_path = ''
        
        for part in parts:
            if part:
                current_path += f'/{part}' if current_path else part
                try:
                    ftp.mkd(current_path)
                    print(f"📁 Created directory: {current_path}")
                except ftplib.error_perm:
                    # Directory already exists or creation failed
                    try:
                        ftp.cwd(current_path)
                        ftp.cwd('/')  # Go back to root
                    except ftplib.error_perm:
                        print(f"❌ Cannot create or access directory: {current_path}")
                        raise
    
    def upload_file(self, ftp, local_file, remote_file):
        """Upload a single file."""
        try:
            with open(local_file, 'rb') as f:
                ftp.storbinary(f'STOR {remote_file}', f)
            print(f"📄 Uploaded: {local_file.name} -> {remote_file}")
            return True
        except Exception as e:
            print(f"❌ Failed to upload {local_file}: {e}")
            return False
    
    def upload_directory(self, ftp, local_dir, remote_dir):
        """Recursively upload a directory."""
        uploaded_count = 0
        
        for item in local_dir.iterdir():
            if self.should_exclude(item):
                print(f"⏭️  Skipped: {item.name}")
                continue
            
            remote_item_path = f"{remote_dir}/{item.name}"
            
            if item.is_file():
                if self.upload_file(ftp, item, remote_item_path):
                    uploaded_count += 1
            elif item.is_dir():
                # Create remote directory
                try:
                    ftp.mkd(remote_item_path)
                    print(f"📁 Created directory: {remote_item_path}")
                except ftplib.error_perm:
                    pass  # Directory might already exist
                
                # Recursively upload directory contents
                sub_count = self.upload_directory(ftp, item, remote_item_path)
                uploaded_count += sub_count
        
        return uploaded_count
    
    def clean_remote_directory(self, ftp, remote_path):
        """Clean the remote app directory before upload."""
        try:
            # Try to change to app directory
            ftp.cwd(remote_path)
            
            # List all items
            items = []
            ftp.retrlines('NLST', items.append)
            
            # Delete files and directories
            for item in items:
                if item not in ['.', '..']:
                    try:
                        # Try to delete as file first
                        ftp.delete(item)
                        print(f"🗑️  Deleted file: {item}")
                    except ftplib.error_perm:
                        # Might be a directory, try to remove it
                        try:
                            self.remove_directory(ftp, item)
                            print(f"🗑️  Deleted directory: {item}")
                        except:
                            print(f"⚠️  Could not delete: {item}")
            
            # Go back to root
            ftp.cwd('/')
            
        except ftplib.error_perm:
            # Directory doesn't exist yet, that's fine
            print(f"📁 Remote directory {remote_path} doesn't exist yet")
    
    def remove_directory(self, ftp, path):
        """Recursively remove a directory."""
        try:
            ftp.cwd(path)
            items = []
            ftp.retrlines('NLST', items.append)
            
            for item in items:
                if item not in ['.', '..']:
                    try:
                        ftp.delete(item)
                    except ftplib.error_perm:
                        self.remove_directory(ftp, item)
            
            ftp.cwd('..')
            ftp.rmd(path)
        except:
            pass
    
    def deploy(self, clean=False):
        """Deploy the app to SiteGround."""
        if not self.check_credentials():
            return False
        
        print("🚀 Starting ContextDescriptionApp deployment to SiteGround...")
        print(f"📂 Local app directory: {self.local_app_dir}")
        print(f"🌐 Remote app path: {self.remote_app_path}")
        
        try:
            with ftplib.FTP(self.host) as ftp:
                print(f"🔗 Connecting to {self.host}...")
                ftp.login(self.username, self.password)
                print("✅ Connected successfully")
                
                # Create remote app directory
                print(f"📁 Creating remote directory: {self.remote_app_path}")
                self.create_remote_directory(ftp, self.remote_app_path)
                
                # Clean remote directory if requested
                if clean:
                    print("🧹 Cleaning remote directory...")
                    self.clean_remote_directory(ftp, self.remote_app_path)
                
                # Upload files
                total_uploaded = 0
                
                for item_name in self.upload_items:
                    local_item = self.local_app_dir / item_name
                    
                    if not local_item.exists():
                        print(f"⚠️  Skipped missing item: {item_name}")
                        continue
                    
                    remote_item_path = f"{self.remote_app_path}/{item_name}"
                    
                    if local_item.is_file():
                        if self.upload_file(ftp, local_item, remote_item_path):
                            total_uploaded += 1
                    elif local_item.is_dir():
                        # Create remote directory
                        try:
                            ftp.mkd(remote_item_path)
                            print(f"📁 Created directory: {remote_item_path}")
                        except ftplib.error_perm:
                            pass  # Directory might already exist
                        
                        # Upload directory contents
                        count = self.upload_directory(ftp, local_item, remote_item_path)
                        total_uploaded += count
                
                print(f"\n🎉 Deployment complete!")
                print(f"📊 Total files uploaded: {total_uploaded}")
                print(f"🌐 App URL: https://bobd77.sg-host.com/app/")
                print(f"🗺️  Tiles URL: https://bobd77.sg-host.com/tiles/")
                
                return True
                
        except ftplib.all_errors as e:
            print(f"❌ FTP error: {e}")
            return False
        except Exception as e:
            print(f"❌ Deployment error: {e}")
            return False

def main():
    """Main deployment script."""
    parser = argparse.ArgumentParser(description='Deploy ContextDescriptionApp to SiteGround')
    parser.add_argument('--clean', action='store_true', 
                       help='Clean remote directory before upload')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be uploaded without actually uploading')
    
    args = parser.parse_args()
    
    deployer = AppDeployer()
    
    if args.dry_run:
        print("🔍 DRY RUN - Showing what would be uploaded:")
        print(f"📂 Local directory: {deployer.local_app_dir}")
        print(f"🌐 Remote path: {deployer.remote_app_path}")
        print("\nItems to upload:")
        
        for item_name in deployer.upload_items:
            local_item = deployer.local_app_dir / item_name
            if local_item.exists():
                if local_item.is_file():
                    print(f"📄 {item_name}")
                else:
                    print(f"📁 {item_name}/")
                    for subitem in local_item.rglob('*'):
                        if not deployer.should_exclude(subitem):
                            rel_path = subitem.relative_to(deployer.local_app_dir)
                            print(f"   📄 {rel_path}")
            else:
                print(f"⚠️  Missing: {item_name}")
        return
    
    # Perform actual deployment
    success = deployer.deploy(clean=args.clean)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()