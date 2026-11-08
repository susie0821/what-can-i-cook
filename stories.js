// Fun stories about how some of our own dishes were invented or got their names,
// keyed by recipe id. Shown behind a "Story behind the dish" button in the recipe,
// so they never get in the way of cooking. Many are legends, and say so.

const DISH_STORIES = {
  "tomato-egg":
    "Tomatoes only reached China a few hundred years ago, which is why their Chinese name, fānqié, means \"foreign eggplant\". For a long time they were grown as a curiosity, and people only started cooking with them widely in the 20th century. So this \"classic\" is actually one of the youngest dishes in Chinese home cooking.",
  "egg-fried-rice":
    "Legend says Emperor Yang of the Sui dynasty (about 1,400 years ago) loved rice fried with egg, which was called \"broken gold rice\" because the bits of egg looked like gold. He is said to have brought it with him on his trips to Yangzhou, and today the most famous version of the dish is still called Yangzhou fried rice.",
  "kung-pao-chicken":
    "The dish is named after Ding Baozhen, a governor of Sichuan in the 1800s whose official title was Gōngbǎo, \"Palace Guardian\". He loved spicy diced chicken with peanuts, and his chefs made it so often it took his title. During the Cultural Revolution the name sounded too imperial, so for years it was renamed \"spicy chicken cubes\".",
  "mapo-tofu":
    "Around the 1860s, a woman named Chen ran a small restaurant near a bridge in Chengdu. Her face had pockmarks from smallpox, so people called her Mápó, \"pockmarked old lady\". She cooked cheap tofu with spicy beef for the porters who carried oil past her door, and the dish became so famous that it took her nickname.",
  "yu-xiang-pork":
    "Yú xiāng means \"fish fragrance\", but there is no fish in it. The name comes from the seasonings Sichuan cooks traditionally used for fish: pickled chili, ginger, garlic, and green onion. Cooking pork the same way gives it that \"fishy-smelling\" flavor without any fish.",
  "yu-xiang-eggplant":
    "A Sichuan legend says a housewife had some sauce left over from cooking fish and didn't want to waste it, so she poured it over the eggplant she was making that evening. Her husband loved it so much that \"fish-fragrant\" became a way of cooking all kinds of dishes, even ones with no fish at all.",
  "red-braised-pork":
    "Nearly 1,000 years ago the poet Su Dongpo, living in exile in Huangzhou, wrote a short poem in praise of pork, which was cheap there because the rich didn't eat it. His advice: use little water and a low fire, and don't rush it; when the time is right, it becomes delicious by itself. Cooks still give the same advice for red-braised pork today.",
  "three-cup-chicken":
    "The name comes from the recipe: one cup of rice wine, one cup of soy sauce, and one cup of sesame oil (or lard). One legend says a jailer cooked it this way for Wen Tianxiang, a loyal Song dynasty official, the night before his execution. The dish comes from Jiangxi, but it became most famous in Taiwan.",
  "beef-broccoli":
    "Western broccoli isn't traditional in China. Chinese cooks in America in the 1900s couldn't find Chinese broccoli (gai lan), so they used the American kind instead. The result became one of the best-known dishes of American Chinese restaurants.",
  "pork-cabbage-dumplings":
    "A popular legend credits Zhang Zhongjing, a famous doctor of the Han dynasty. On a freezing winter, he saw that poor villagers had frostbitten ears, so he wrapped mutton and warming herbs in dough shaped like ears and handed them out. That's why people say that if you don't eat dumplings at the winter solstice, your ears will freeze off.",
  oyakodon:
    "Oyakodon means \"parent-and-child bowl\": the chicken and the egg. It is said to have started in 1891 at a Tokyo chicken restaurant, where diners liked to finish their chicken hotpot by pouring egg into the broth and eating it over rice. The restaurant turned the leftovers into a dish of its own.",
  shakshuka:
    "Shakshuka comes from North Africa, probably Tunisia, and its name is often said to mean \"all mixed up\". Jewish families from Tunisia and Libya brought it with them to Israel, where it became a favorite breakfast. Tomatoes only reached the region after they were brought from the Americas, so the dish is younger than it seems.",
  "spanish-tortilla":
    "A favorite Spanish story says General Zumalacárregui invented it in the 1830s to feed his hungry soldiers with just eggs, potatoes, and onions. Historians have found a written mention from 1817, before his war, so the story probably isn't true. Spaniards still argue about the real question: with onion or without?",
  "egg-tarts":
    "In the 1920s, department stores in Guangzhou competed by offering a new \"weekly special\" pastry, and bakers borrowed the idea of the English custard tart. Cantonese bakers brought it to Hong Kong, where it became a tea-restaurant classic. Macau has a different, caramelized version, based on the Portuguese pastel de nata.",
  "double-skin-milk":
    "This dessert comes from Shunde in Guangdong. A local story says that in the Qing dynasty a farmer was trying to keep buffalo milk from going bad by boiling it, and noticed that a soft skin formed on top as it cooled. Pouring the milk out under the first skin and back in again made a second skin, giving the dessert its name.",
  "ginger-tangyuan":
    "These rice balls are eaten for the Lantern Festival, and in the north they were called yuánxiāo. A popular story says that around 1915 Yuan Shikai, who wanted to become emperor, banned the word because \"yuánxiāo\" sounds like \"remove Yuan\". Whether or not it's true, the name tāngyuán, \"soup balls\", is the one most people use today.",
};
