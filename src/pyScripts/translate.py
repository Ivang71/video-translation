from googletrans import Translator
import argparse

parser = argparse.ArgumentParser(description='Translate text using Google Translate.')
parser.add_argument('--dest', type=str, help='Destination language code')
parser.add_argument('--text', type=str, nargs='+', help='Texts to translate')
args = parser.parse_args()

# print(args.text)
if args.dest and args.text:
    translated_texts = [Translator().translate(text, dest=args.dest).text for text in args.text]
    print(translated_texts)
else:
    raise "Some arguments are missing"
