import nltk
import json
data = json.load(
    open("source/cleaned_data_sm.json", 'r'))
bow = []
for d1 in data:
    bow.extend(d1.split())
fdist1 = nltk.FreqDist(bow)

'''
break the json into words
json is already cleaned data
'''

def save_top_words(words, filename):
    print('saving data into: ', filename)
    newline = '\n'
    tab = '\t'
    f = open(filename, "w+")
    for word in words:
        f.write(str(word[1]) + tab + word[0] + newline)
    f.close()


save_top_words(fdist1.most_common(), 'result/top_words_sm.txt')
