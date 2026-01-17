import os
import shutil
import urllib.request
import urllib.error
from flask import request, current_app, jsonify
from werkzeug.utils import secure_filename


def upload_file():
    """Handle file upload and return the file path or an error."""
    try:
        if 'file' not in request.files:
            return {'status': 'error', 'error': {'message': 'No file part'}}
        file = request.files['file']
        if file.filename == '':
            return {'status': 'error', 'error': {'message': 'No selected file'}}

        filename = secure_filename(file.filename)
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        file.save(save_path)

        return {'status': 'success', 'path': save_path}
    except Exception as e:
        return {'status': 'error', 'error': {'message': 'An error occurred during processing.', 'details': str(e)}}


def start_check(checker, file_path: str):
    """Run the checker on the uploaded file and return the results."""
    try:
        checker.set_source_file_path(file_path)
        checker.run_state_machine()

        checker_json = checker.results.get_formatted_results_json()
        result_json = {
            "type": "data",
            "content": {
                "results": checker_json,
            }
        }
        return jsonify(result_json), 200
    except Exception as e:
        return jsonify({'error': 'An error occurred during the check.', 'details': str(e)}), 500


def download_file_from_url(download_url: str, max_size_bytes: int = 300 * 1024 * 1024) -> dict:
    """
    Download a file from a URL with size limit checking.

    Args:
        download_url: URL to download from
        max_size_bytes: Maximum file size in bytes (default: 300MB)

    Returns:
        dict with 'status' ('success' or 'error') and either 'path' or 'error'
    """
    try:
        # Validate URL format
        if not download_url or not isinstance(download_url, str):
            return {'status': 'error', 'error': {'message': 'Invalid URL provided'}}

        # Check if URL starts with http:// or https://
        if not (download_url.startswith('http://') or download_url.startswith('https://')):
            return {'status': 'error', 'error': {'message': 'URL must start with http:// or https://'}}

        # Create request with headers to support streaming
        req = urllib.request.Request(download_url)
        req.add_header('User-Agent', 'TemplateChecker/1.0')

        # Open connection and check content-length if available
        with urllib.request.urlopen(req, timeout=30) as response:
            # Check Content-Length header if available
            content_length = response.headers.get('Content-Length')
            if content_length:
                file_size = int(content_length)
                if file_size > max_size_bytes:
                    max_size_mb = max_size_bytes / (1024 * 1024)
                    file_size_mb = file_size / (1024 * 1024)
                    return {
                        'status': 'error',
                        'error': {
                            'message': f'File size ({file_size_mb:.2f}MB) exceeds maximum allowed size ({max_size_mb:.0f}MB)'
                        }
                    }

            # Validate content type is ZIP if available
            content_type = response.headers.get('Content-Type', '')
            if content_type and 'zip' not in content_type.lower() and 'octet-stream' not in content_type.lower():
                # Allow if content-type is not specified, but warn if it's clearly not a ZIP
                pass

            # Generate a safe filename from URL
            filename = os.path.basename(urllib.request.urlparse(download_url).path)
            if not filename or not filename.endswith('.zip'):
                filename = 'downloaded_file.zip'

            filename = secure_filename(filename)
            if not filename:
                filename = 'downloaded_file.zip'

            save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)

            # Download with size checking
            downloaded_size = 0
            chunk_size = 8192  # 8KB chunks

            with open(save_path, 'wb') as out_file:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break

                    downloaded_size += len(chunk)

                    # Check size during download (in case Content-Length wasn't available)
                    if downloaded_size > max_size_bytes:
                        out_file.close()
                        # Clean up partially downloaded file
                        try:
                            os.remove(save_path)
                        except:
                            pass
                        max_size_mb = max_size_bytes / (1024 * 1024)
                        downloaded_size_mb = downloaded_size / (1024 * 1024)
                        return {
                            'status': 'error',
                            'error': {
                                'message': f'File size ({downloaded_size_mb:.2f}MB) exceeds maximum allowed size ({max_size_mb:.0f}MB)'
                            }
                        }

                    out_file.write(chunk)

            # Verify downloaded file is a ZIP file by checking file extension and magic bytes
            if not save_path.endswith('.zip'):
                try:
                    os.remove(save_path)
                except:
                    pass
                return {'status': 'error', 'error': {'message': 'Downloaded file must be a ZIP file'}}

            # Verify it's actually a ZIP by checking magic bytes
            try:
                with open(save_path, 'rb') as f:
                    magic_bytes = f.read(4)
                    # ZIP files start with PK\x03\x04 or PK\x05\x06 (empty ZIP) or PK\x07\x08 (spanned ZIP)
                    if not (magic_bytes.startswith(b'PK\x03\x04') or magic_bytes.startswith(b'PK\x05\x06') or magic_bytes.startswith(b'PK\x07\x08')):
                        os.remove(save_path)
                        return {'status': 'error', 'error': {'message': 'Downloaded file is not a valid ZIP file'}}
            except Exception as e:
                try:
                    os.remove(save_path)
                except:
                    pass
                return {'status': 'error', 'error': {'message': f'Failed to validate ZIP file: {str(e)}'}}

            return {'status': 'success', 'path': save_path}

    except urllib.error.HTTPError as e:
        return {
            'status': 'error',
            'error': {
                'message': f'HTTP error {e.code} when downloading file',
                'details': str(e.reason) if hasattr(e, 'reason') else str(e)
            }
        }
    except urllib.error.URLError as e:
        return {
            'status': 'error',
            'error': {
                'message': 'Failed to download file from URL',
                'details': str(e.reason) if hasattr(e, 'reason') else str(e)
            }
        }
    except TimeoutError:
        return {
            'status': 'error',
            'error': {'message': 'Download timeout - the server took too long to respond'}
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': {
                'message': 'An error occurred while downloading the file',
                'details': str(e)
            }
        }


def checker_cleanup(checker):
    """Cleanup the checker and remove uploaded files."""
    checker.delete_unzipped_root_path()
    for file in os.listdir(current_app.config['UPLOAD_FOLDER']):
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], file)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print(f'Failed to delete {file_path}. Reason: {e}')
