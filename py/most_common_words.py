import spacy
from spacy import displacy
import nltk
import json
import tqdm

nlp = spacy.load('pt_core_news_sm')

text = 'precisa se de um profissional que trabalhe com tile para sabado trabalho e pequeno contato '
#doc = nlp(text)

data = json.load(
    open("source/cleaned_data_sm.json", 'r'))
docs = []
bow = []


'''
    save lemma words
    token.lemma_ and token.text could be synonymous
'''

for d1 in tqdm.tqdm(data):
    doc = nlp(d1)
    text = ''
    for token in doc:
        if token.is_stop == False and token.is_alpha and token.pos_ not in ['CCONJ', 'PRON', 'NUM', 'DET']:
            bow.append(token.lemma_)
            bow.append(token.text)
#    print(text)
fdist1 = nltk.FreqDist(bow)


def save_top_words(words, filename):
    print('saving data into: ', filename)
    newline = '\n'
    tab = '\t'
    f = open(filename, "w+")
    for word in words:
        f.write(str(word[1]) + tab + word[0] + newline)
    f.close()


most_common_words = fdist1.most_common()
save_top_words(most_common_words, 'result/most_common_words_sm.txt')
